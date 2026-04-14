import { Request, Response, NextFunction } from "express";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { ForbiddenError } from "../errors/appError.js";

export interface EncounterAuthorizationOptions {
  requireOwnership?: boolean;
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

export const authorizeEncounterAccess = (
  options: EncounterAuthorizationOptions = {},
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
      const isPrivilegedUser = user.roles.some(
        (role) =>
          role === "clinician" ||
          role === "admin" ||
          role === "reception" ||
          role === "billing",
      );

      if (isPrivilegedUser || !options.requireOwnership) {
        next();
        return;
      }

      if (!user.roles.includes("patient")) {
        throw new ForbiddenError("Insufficient permissions");
      }

      const actorPatientId = user.patientId ?? user.id;
      const requestedPatientId = req.params.patientId || req.body?.patientId;
      const requestedEncounterId = req.params.id || req.body?.encounterId;

      if (requestedPatientId && requestedPatientId !== actorPatientId) {
        throw new ForbiddenError("Cannot access other patient's encounters");
      }

      if (requestedEncounterId) {
        const encounterPatientId =
          await getPatientIdForEncounter(requestedEncounterId);

        if (
          encounterPatientId !== null &&
          encounterPatientId !== actorPatientId
        ) {
          throw new ForbiddenError("Cannot access this encounter");
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
