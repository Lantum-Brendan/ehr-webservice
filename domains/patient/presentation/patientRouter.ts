import { Router } from "express";
import { z } from "zod";
import { validate } from "@core/middleware/validateMiddleware.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { CreatePatientUseCase } from "../application/createPatientUseCase.js";
import { UpdatePatientUseCase } from "../application/updatePatientUseCase.js";
import { DeletePatientUseCase } from "../application/deletePatientUseCase.js";
import { PrismaPatientRepository } from "../infrastructure/prismaPatientRepository.js";
import { logger } from "@shared/logger/index.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";

// In-memory event bus implementation (would be injected in real app)
class MockEventBus implements IEventBus {
  publish(): Promise<void> {
    return Promise.resolve();
  }
  subscribe(): () => void {
    return () => {};
  }
  subscribeAll(): () => void {
    return () => {};
  }
  clear(): void {}
}

// Dependency injection - in real app this would come from a module file
const patientRepo = new PrismaPatientRepository();
const eventBus = new MockEventBus();
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

// Zod validation schema for patient creation
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

// Zod validation schema for patient update
const updatePatientSchema = z
  .object({
    firstName: z.string().min(1, "First name is required").optional(),
    lastName: z.string().min(1, "Last name is required").optional(),
  })
  .refine(
    (data) => data.firstName !== undefined || data.lastName !== undefined,
    { message: "At least one of firstName or lastName must be provided" },
  );

export const patientRouter = Router();

// POST /api/v1/patients - Create a new patient
patientRouter.post(
  "/",
  requireRole("clinician", "admin"), // Only clinicians and admins can create patients
  validate({ body: createPatientSchema }),
  async (req, res, next) => {
    try {
      const patient = await createPatientUseCase.execute(req.body);
      res.status(201).json({
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
        dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
        age: patient.age,
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/patients - List all patients (for demo/testing)
patientRouter.get(
  "/",
  requireRole("clinician", "admin", "billing"),
  async (_req, res, next) => {
    try {
      // This would normally come from a use case
      const patients = await patientRepo.findAll();
      res.json({
        patients: patients.map((p) => ({
          id: p.id,
          mrn: p.mrn,
          firstName: p.firstNameValue,
          lastName: p.lastNameValue,
          dateOfBirth: p.dateOfBirthValue.toISOString().split("T")[0],
          age: p.age,
        })),
      });
    } catch (error) {
      next(error);
    }
  },
);

// GET /api/v1/patients/:id - Get patient by ID
patientRouter.get(
  "/:id",
  requireRole("clinician", "admin", "billing"),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      const patient = await patientRepo.findById(req.params.id);
      if (!patient) {
        res.status(404).json({ error: { message: "Patient not found" } });
        return;
      }

      res.json({
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
        dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
        age: patient.age,
      });
    } catch (error) {
      next(error);
    }
  },
);

// PUT /api/v1/patients/:id - Update a patient
patientRouter.put(
  "/:id",
  requireRole("clinician", "admin"),
  validate({ params: z.object({ id: z.string() }) }),
  validate({ body: updatePatientSchema }),
  async (req, res, next) => {
    try {
      const patient = await updatePatientUseCase.execute(
        req.params.id,
        req.body,
      );
      res.json({
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
        dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
        age: patient.age,
      });
    } catch (error) {
      next(error);
    }
  },
);

// DELETE /api/v1/patients/:id - Delete a patient
patientRouter.delete(
  "/:id",
  requireRole("clinician", "admin"),
  validate({ params: z.object({ id: z.string() }) }),
  async (req, res, next) => {
    try {
      await deletePatientUseCase.execute(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  },
);
