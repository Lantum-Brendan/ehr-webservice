import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors/appError.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export interface BillingAuthorizationOptions {
  requireOwnership?: boolean;
}

async function getPatientIdForInvoice(
  invoiceId: string,
): Promise<string | null> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { patientId: true },
  });
  return invoice?.patientId ?? null;
}

async function getPatientIdForEncounter(
  encounterId: string,
): Promise<string | null> {
  const encounter = await prisma.encounter.findUnique({
    where: { id: encounterId },
    select: { patientId: true },
  });
  return encounter?.patientId ?? null;
}

/**
 * Middleware that checks if user has access to billing resource
 * - Admins/billing can access all
 * - Patients can only access their own invoices if requireOwnership is true
 * - Also verifies the referenced patientId matches the patient's ID
 */
export const authorizeBillingAccess = (
  options: BillingAuthorizationOptions = {},
) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError("Authentication required");
      }

      const user = req.user;
      const isAdminOrBilling = user.roles.some(
        (r) => r === "admin" || r === "billing",
      );

      if (isAdminOrBilling) {
        next();
        return;
      }

      if (options.requireOwnership && user.patientId) {
        const requestedPatientId = req.params.patientId;
        const requestedInvoiceId = req.params.id || req.body?.invoiceId;
        const requestedEncounterId = req.body?.encounterId;

        if (requestedPatientId && requestedPatientId !== user.patientId) {
          throw new ForbiddenError("Cannot access other patient's invoices");
        }

        if (requestedInvoiceId) {
          const invoicePatientId =
            await getPatientIdForInvoice(requestedInvoiceId);
          if (invoicePatientId !== user.patientId) {
            throw new ForbiddenError("Cannot access this invoice");
          }
        }

        if (requestedEncounterId) {
          const encounterPatientId =
            await getPatientIdForEncounter(requestedEncounterId);
          if (encounterPatientId !== user.patientId) {
            throw new ForbiddenError(
              "Cannot create invoice for this encounter",
            );
          }
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
