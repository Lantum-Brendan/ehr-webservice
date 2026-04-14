import { Router } from "express";
import { z } from "zod";
import { authorizeEncounterAccess } from "@core/guards/encounterAuthGuard.js";
import { authorizePatientAccess } from "@core/guards/patientAuthGuard.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { validate } from "@core/middleware/validateMiddleware.js";
import { PrismaAppointmentRepository } from "@domains/appointment/infrastructure/prismaAppointmentRepository.js";
import { PrismaPatientRepository } from "@domains/patient/infrastructure/prismaPatientRepository.js";
import { sharedEventBus } from "@shared/event-bus/index.js";
import { logger } from "@shared/logger/index.js";
import { CreateEncounterUseCase } from "../application/createEncounterUseCase.js";
import {
  GetEncounterUseCase,
  GetEncountersForPatientUseCase,
  GetEncountersForProviderUseCase,
} from "../application/getEncounterUseCase.js";
import {
  CancelEncounterUseCase,
  CompleteEncounterUseCase,
  DeleteEncounterUseCase,
  StartEncounterUseCase,
} from "../application/manageEncounterUseCase.js";
import { PrismaEncounterRepository } from "../infrastructure/prismaEncounterRepository.js";
import { toEncounterDto } from "./encounterDto.js";

const encounterRepo = new PrismaEncounterRepository();
const patientRepo = new PrismaPatientRepository();
const appointmentRepo = new PrismaAppointmentRepository();
const eventBus = sharedEventBus;

const createEncounterUseCase = new CreateEncounterUseCase(
  encounterRepo,
  patientRepo,
  appointmentRepo,
  eventBus,
  logger,
);
const getEncounterUseCase = new GetEncounterUseCase(encounterRepo, logger);
const getEncountersForPatientUseCase = new GetEncountersForPatientUseCase(
  encounterRepo,
  patientRepo,
);
const getEncountersForProviderUseCase = new GetEncountersForProviderUseCase(
  encounterRepo,
);
const startEncounterUseCase = new StartEncounterUseCase(
  encounterRepo,
  eventBus,
  logger,
);
const completeEncounterUseCase = new CompleteEncounterUseCase(
  encounterRepo,
  eventBus,
  logger,
);
const cancelEncounterUseCase = new CancelEncounterUseCase(
  encounterRepo,
  eventBus,
  logger,
);
const deleteEncounterUseCase = new DeleteEncounterUseCase(
  encounterRepo,
  eventBus,
  logger,
);

const encounterIdSchema = z.string().uuid("Invalid encounter ID");
const patientIdSchema = z.string().uuid("Invalid patient ID");
const encounterTypeSchema = z.enum([
  "outpatient",
  "inpatient",
  "emergency",
  "telehealth",
  "virtual",
]);

const createEncounterSchema = z.object({
  patientId: patientIdSchema,
  appointmentId: z.string().trim().min(1).optional(),
  providerId: z.string().trim().min(1).optional(),
  encounterType: encounterTypeSchema,
  startTime: z.string().datetime().optional(),
  endTime: z.string().datetime().optional(),
  status: z.enum(["planned", "arrived", "in-progress"]).optional(),
});

const encounterParamsSchema = z.object({
  id: encounterIdSchema,
});

const patientParamsSchema = z.object({
  patientId: patientIdSchema,
});

const providerParamsSchema = z.object({
  providerId: z.string().trim().min(1, "Provider ID is required"),
});

const startEncounterSchema = z.object({
  startTime: z.string().datetime().optional(),
});

const completeEncounterSchema = z.object({
  endTime: z.string().datetime().optional(),
});

export const encounterRouter = Router();

encounterRouter.post(
  "/",
  requireRole("admin", "reception", "clinician"),
  validate({ body: createEncounterSchema }),
  async (req, res, next) => {
    try {
      const encounter = await createEncounterUseCase.execute(req.body);
      res.status(201).json(toEncounterDto(encounter));
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.get(
  "/patient/:patientId",
  requireRole("admin", "reception", "clinician", "billing", "patient"),
  validate({ params: patientParamsSchema }),
  authorizePatientAccess({ requireOwnership: true }),
  async (req, res, next) => {
    try {
      const encounters = await getEncountersForPatientUseCase.execute(
        req.params.patientId,
      );

      res.json({
        encounters: encounters.map(toEncounterDto),
      });
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.get(
  "/provider/:providerId",
  requireRole("admin", "reception", "clinician", "billing"),
  validate({ params: providerParamsSchema }),
  async (req, res, next) => {
    try {
      const encounters = await getEncountersForProviderUseCase.execute(
        req.params.providerId,
      );

      res.json({
        encounters: encounters.map(toEncounterDto),
      });
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.put(
  "/:id/start",
  requireRole("admin", "reception", "clinician"),
  validate({ params: encounterParamsSchema }),
  validate({ body: startEncounterSchema }),
  async (req, res, next) => {
    try {
      const encounter = await startEncounterUseCase.execute(
        req.params.id,
        req.body,
      );

      res.json(toEncounterDto(encounter));
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.put(
  "/:id/end",
  requireRole("admin", "reception", "clinician"),
  validate({ params: encounterParamsSchema }),
  validate({ body: completeEncounterSchema }),
  async (req, res, next) => {
    try {
      const encounter = await completeEncounterUseCase.execute(
        req.params.id,
        req.body,
      );

      res.json(toEncounterDto(encounter));
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.put(
  "/:id/cancel",
  requireRole("admin", "reception", "clinician"),
  validate({ params: encounterParamsSchema }),
  async (req, res, next) => {
    try {
      const encounter = await cancelEncounterUseCase.execute(req.params.id);
      res.json(toEncounterDto(encounter));
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.get(
  "/:id",
  requireRole("admin", "reception", "clinician", "billing", "patient"),
  validate({ params: encounterParamsSchema }),
  authorizeEncounterAccess({ requireOwnership: true }),
  async (req, res, next) => {
    try {
      const encounter = await getEncounterUseCase.execute(req.params.id);
      res.json(toEncounterDto(encounter));
    } catch (error) {
      next(error);
    }
  },
);

encounterRouter.delete(
  "/:id",
  requireRole("admin"),
  validate({ params: encounterParamsSchema }),
  async (req, res, next) => {
    try {
      await deleteEncounterUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
