import { Router } from "express";
import { z } from "zod";
import { validate } from "@core/middleware/validateMiddleware.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { authorizeBillingAccess } from "@core/guards/billingAuthGuard.js";
import { CreateInvoiceUseCase } from "../application/createInvoiceUseCase.js";
import { AddLineItemUseCase } from "../application/addLineItemUseCase.js";
import { RecordPaymentUseCase } from "../application/recordPaymentUseCase.js";
import { GetInvoicesForPatientUseCase } from "../application/getInvoicesForPatientUseCase.js";
import { GetInvoiceDetailUseCase } from "../application/getInvoiceDetailUseCase.js";
import { PrismaBillingRepository } from "../infrastructure/prismaBillingRepository.js";
import { logger } from "@shared/logger/index.js";

const billingRepo = new PrismaBillingRepository();

const createInvoiceUseCase = new CreateInvoiceUseCase(billingRepo, logger);
const addLineItemUseCase = new AddLineItemUseCase(billingRepo, logger);
const recordPaymentUseCase = new RecordPaymentUseCase(billingRepo, logger);
const getInvoicesForPatientUseCase = new GetInvoicesForPatientUseCase(
  billingRepo,
  logger,
);
const getInvoiceDetailUseCase = new GetInvoiceDetailUseCase(
  billingRepo,
  logger,
);

const createInvoiceSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  encounterId: z.string().uuid().optional(),
  notes: z.string().optional(),
  dueDate: z.string().optional(),
});

const paginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

const addLineItemSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  description: z.string().min(1, "Description is required"),
  cptCode: z.string().optional(),
  quantity: z.number().int().positive().optional(),
  unitPrice: z.number().positive("Unit price must be positive"),
});

const recordPaymentSchema = z.object({
  invoiceId: z.string().uuid("Invalid invoice ID"),
  amount: z.number().positive("Amount must be positive"),
  method: z.enum(["CASH", "CARD", "CHECK", "BANK_TRANSFER"]),
  reference: z.string().optional(),
});

export const billingRouter = Router();

billingRouter.post(
  "/invoices",
  requireRole("billing", "admin"),
  validate({ body: createInvoiceSchema }),
  async (req, res, next) => {
    try {
      const invoice = await createInvoiceUseCase.execute(req.body);
      res.status(201).json(invoice.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

billingRouter.get(
  "/invoices/patient/:patientId",
  requireRole("billing", "admin"),
  authorizeBillingAccess({ requireOwnership: true }),
  validate({ params: z.object({ patientId: z.string().uuid() }) }),
  validate({ query: paginationSchema }),
  async (req, res, next) => {
    try {
      const result = await getInvoicesForPatientUseCase.execute(
        req.params.patientId,
        {
          page: req.query.page as unknown as number,
          limit: req.query.limit as unknown as number,
        },
      );
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

billingRouter.get(
  "/invoices/:id",
  requireRole("billing", "admin"),
  authorizeBillingAccess({ requireOwnership: true }),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const detail = await getInvoiceDetailUseCase.execute(req.params.id);
      res.json({
        invoice: detail.invoice.toJSON(),
        lineItems: detail.lineItems.map((li) => li.toJSON()),
        payments: detail.payments.map((p) => p.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  },
);

billingRouter.post(
  "/invoices/line-items",
  requireRole("billing", "admin"),
  authorizeBillingAccess({ requireOwnership: true }),
  validate({ body: addLineItemSchema }),
  async (req, res, next) => {
    try {
      const lineItem = await addLineItemUseCase.execute(req.body);
      res.status(201).json(lineItem.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

billingRouter.post(
  "/payments",
  requireRole("billing", "admin"),
  authorizeBillingAccess({ requireOwnership: true }),
  validate({ body: recordPaymentSchema }),
  async (req, res, next) => {
    try {
      const payment = await recordPaymentUseCase.execute(req.body);
      res.status(201).json(payment.toJSON());
    } catch (error) {
      next(error);
    }
  },
);
