import { Router } from "express";
import { z } from "zod";
import { validate } from "@core/middleware/validateMiddleware.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { CreateLabOrderUseCase } from "../application/createLabOrderUseCase.js";
import { UpdateLabOrderUseCase } from "../application/updateLabOrderUseCase.js";
import { AddLabResultUseCase } from "../application/addLabResultUseCase.js";
import {
  GetLabOrderUseCase,
  GetLabOrdersForPatientUseCase,
} from "../application/getLabOrderUseCase.js";
import { PrismaLabRepository } from "../infrastructure/prismaLabRepository.js";
import { logger } from "@shared/logger/index.js";

const labRepo = new PrismaLabRepository();

const createLabOrderUseCase = new CreateLabOrderUseCase(labRepo, logger);
const updateLabOrderUseCase = new UpdateLabOrderUseCase(labRepo, logger);
const addLabResultUseCase = new AddLabResultUseCase(labRepo, logger);
const getLabOrderUseCase = new GetLabOrderUseCase(labRepo, logger);
const getLabOrdersForPatientUseCase = new GetLabOrdersForPatientUseCase(
  labRepo,
  logger,
);

const createLabOrderSchema = z.object({
  patientId: z.string().uuid("Invalid patient ID"),
  clinicianId: z.string().uuid("Invalid clinician ID"),
  encounterId: z.string().uuid().optional(),
  testType: z.string().min(1, "Test type is required"),
  priority: z.enum(["STAT", "ROUTINE", "URGENT"]).optional(),
  notes: z.string().optional(),
});

const updateLabOrderSchema = z.object({
  action: z.enum(["COLLECT", "IN_PROGRESS", "COMPLETE", "CANCEL"]),
});

const addLabResultSchema = z.object({
  testName: z.string().min(1, "Test name is required"),
  value: z.string().min(1, "Value is required"),
  unit: z.string().optional(),
  referenceRange: z.string().optional(),
  flag: z.enum(["NORMAL", "ABNORMAL", "CRITICAL"]).optional(),
});

export const labRouter = Router();

labRouter.post(
  "/orders",
  requireRole("clinician", "admin"),
  validate({ body: createLabOrderSchema }),
  async (req, res, next) => {
    try {
      const order = await createLabOrderUseCase.execute(req.body);
      res.status(201).json(order.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

labRouter.get(
  "/orders/patient/:patientId",
  requireRole("clinician", "admin", "billing"),
  validate({ params: z.object({ patientId: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const orders = await getLabOrdersForPatientUseCase.execute(
        req.params.patientId,
      );
      res.json({
        orders: orders.map((o) => o.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  },
);

labRouter.get(
  "/orders/:id",
  requireRole("clinician", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  async (req, res, next) => {
    try {
      const detail = await getLabOrderUseCase.execute(req.params.id);
      if (!detail) {
        res.status(404).json({ error: { message: "Lab order not found" } });
        return;
      }
      res.json({
        order: detail.order.toJSON(),
        results: detail.results.map((r) => r.toJSON()),
      });
    } catch (error) {
      next(error);
    }
  },
);

labRouter.patch(
  "/orders/:id",
  requireRole("clinician", "admin"),
  validate({ params: z.object({ id: z.string().uuid() }) }),
  validate({ body: updateLabOrderSchema }),
  async (req, res, next) => {
    try {
      const order = await updateLabOrderUseCase.execute({
        orderId: req.params.id,
        action: req.body.action,
      });
      res.json(order.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

labRouter.post(
  "/orders/:orderId/results",
  requireRole("clinician", "admin"),
  validate({ params: z.object({ orderId: z.string().uuid() }) }),
  validate({ body: addLabResultSchema }),
  async (req, res, next) => {
    try {
      const result = await addLabResultUseCase.execute({
        ...req.body,
        orderId: req.params.orderId,
      });
      res.status(201).json(result.toJSON());
    } catch (error) {
      next(error);
    }
  },
);
