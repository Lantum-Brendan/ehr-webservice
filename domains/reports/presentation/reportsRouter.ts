import { Router } from "express";
import { z } from "zod";
import { validate } from "@core/middleware/validateMiddleware.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { GeneratePatientSummaryUseCase } from "../application/generatePatientSummaryUseCase.js";
import { GenerateLabSummaryUseCase } from "../application/generateLabSummaryUseCase.js";
import { logger } from "@shared/logger/index.js";

const patientSummarySchema = z.object({
  patientId: z.string().uuid(),
});

const labSummarySchema = z.object({
  patientId: z.string().uuid(),
  startDate: z.string(),
  endDate: z.string(),
});

const generatePatientSummaryUseCase = new GeneratePatientSummaryUseCase(logger);
const generateLabSummaryUseCase = new GenerateLabSummaryUseCase(logger);

export const reportsRouter = Router();

reportsRouter.get(
  "/patient-summary",
  requireRole("clinician", "admin"),
  validate({ query: patientSummarySchema }),
  async (req, res, next) => {
    try {
      const report = await generatePatientSummaryUseCase.execute(
        req.query.patientId as string,
      );
      res.json(report);
    } catch (error) {
      next(error);
    }
  },
);

reportsRouter.get(
  "/lab-summary",
  requireRole("clinician", "admin"),
  validate({ query: labSummarySchema }),
  async (req, res, next) => {
    try {
      const report = await generateLabSummaryUseCase.execute(
        req.query.patientId as string,
        req.query.startDate as string,
        req.query.endDate as string,
      );
      res.json(report);
    } catch (error) {
      next(error);
    }
  },
);
