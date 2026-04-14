import { Router } from "express";
import { z } from "zod";
import { validate } from "@core/middleware/validateMiddleware.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { authorizePatientAccess } from "@core/guards/patientAuthGuard.js";
import { CreatePatientUseCase } from "../application/createPatientUseCase.js";
import { UpdatePatientUseCase } from "../application/updatePatientUseCase.js";
import { DeletePatientUseCase } from "../application/deletePatientUseCase.js";
import { GetPatientUseCase } from "../application/getPatientUseCase.js";
import { PrismaPatientRepository } from "../infrastructure/prismaPatientRepository.js";
import { logger } from "@shared/logger/index.js";
import { InMemoryEventBus } from "@shared/event-bus/event-bus.interface.js";

const patientRepo = new PrismaPatientRepository();
const eventBus = new InMemoryEventBus();

const createPatientUseCase = new CreatePatientUseCase(
  patientRepo,
  eventBus,
  logger,
);
const updatePatientUseCase = new UpdatePatientUseCase(
  patientRepo,
  eventBus,
  logger,
);
const deletePatientUseCase = new DeletePatientUseCase(
  patientRepo,
  eventBus,
  logger,
);
const getPatientUseCase = new GetPatientUseCase(patientRepo, logger);

const createPatientSchema = z.object({
  mrn: z
    .string()
    .min(6)
    .max(12)
    .regex(/^[A-Z0-9]+$/, "MRN must be uppercase alphanumeric"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  dateOfBirth: z.string().refine(
    (date) => {
      const d = new Date(date);
      return !isNaN(d.getTime()) && d <= new Date();
    },
    { message: "Date of birth must be a valid past date" },
  ),
});

const updatePatientSchema = z
  .object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
  })
  .refine(
    (data) => data.firstName !== undefined || data.lastName !== undefined,
    { message: "At least one of firstName or lastName must be provided" },
  );

export const patientRouter = Router();
const patientIdParamsSchema = z.object({
  id: z.string().uuid("Invalid patient ID"),
});

function toPatientDto(patient: {
  id: string;
  mrn: string;
  firstNameValue: string;
  lastNameValue: string;
  dateOfBirthValue: Date;
  age: number;
}) {
  return {
    id: patient.id,
    mrn: patient.mrn,
    firstName: patient.firstNameValue,
    lastName: patient.lastNameValue,
    dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
    age: patient.age,
  };
}

patientRouter.post(
  "/",
  requireRole("clinician", "admin"),
  validate({ body: createPatientSchema }),
  async (req, res, next) => {
    try {
      const patient = await createPatientUseCase.execute(req.body);
      res.status(201).json(toPatientDto(patient));
    } catch (error) {
      next(error);
    }
  },
);

patientRouter.get(
  "/",
  requireRole("clinician", "admin", "billing"),
  async (_req, res, next) => {
    try {
      const patients = await patientRepo.findAll();
      res.json({
        patients: patients.map(toPatientDto),
      });
    } catch (error) {
      next(error);
    }
  },
);

patientRouter.get(
  "/:id",
  requireRole("clinician", "admin", "billing", "patient"),
  authorizePatientAccess({ requireOwnership: true }),
  validate({ params: patientIdParamsSchema }),
  async (req, res, next) => {
    try {
      const patient = await getPatientUseCase.execute(req.params.id);
      res.json(toPatientDto(patient));
    } catch (error) {
      next(error);
    }
  },
);

patientRouter.put(
  "/:id",
  requireRole("clinician", "admin"),
  validate({ params: patientIdParamsSchema }),
  validate({ body: updatePatientSchema }),
  async (req, res, next) => {
    try {
      const patient = await updatePatientUseCase.execute(
        req.params.id,
        req.body,
      );
      res.json(toPatientDto(patient));
    } catch (error) {
      next(error);
    }
  },
);

patientRouter.delete(
  "/:id",
  requireRole("clinician", "admin"),
  validate({ params: patientIdParamsSchema }),
  async (req, res, next) => {
    try {
      await deletePatientUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
