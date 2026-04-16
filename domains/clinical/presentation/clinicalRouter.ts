import { Router } from "express";
import { z } from "zod";
import { validate } from "@core/middleware/validateMiddleware.js";
import { requireRole } from "@core/guards/roleGuard.js";
import {
  CreateDiagnosisUseCase,
  UpdateDiagnosisUseCase,
  GetDiagnosesForPatientUseCase,
} from "../application/diagnosisUseCase.ts";
import {
  CreateAllergyUseCase,
  UpdateAllergyUseCase,
  GetAllergiesForPatientUseCase,
} from "../application/allergyUseCase.ts";
import {
  CreateMedicationUseCase,
  UpdateMedicationUseCase,
  GetMedicationsForPatientUseCase,
} from "../application/medicationUseCase.ts";
import { PrismaClinicalRepository } from "../infrastructure/prismaClinicalRepository.js";
import { logger } from "@shared/logger/index.js";

const clinicalRepo = new PrismaClinicalRepository();

const createDiagnosisSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  code: z.string().min(1, "ICD code required"),
  description: z.string().min(1),
  onsetDate: z.string().optional(),
  recordedBy: z.string().uuid(),
});

const createAllergySchema = z.object({
  patientId: z.string().uuid(),
  allergen: z.string().min(1),
  type: z.enum(["DRUG", "FOOD", "ENVIRONMENTAL"]),
  severity: z.enum(["MILD", "MODERATE", "SEVERE", "LIFE_THREATENING"]),
  reaction: z.string().optional(),
  recordedBy: z.string().uuid(),
});

const createMedicationSchema = z.object({
  patientId: z.string().uuid(),
  encounterId: z.string().uuid().optional(),
  name: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  route: z.enum([
    "ORAL",
    "IV",
    "IM",
    "SC",
    "TOPICAL",
    "INHALED",
    "RECTAL",
    "SUBLINGUAL",
  ]),
  startDate: z.string(),
  prescribedBy: z.string().uuid(),
});

export const clinicalRouter = Router();

const createDiagnosisUseCase = new CreateDiagnosisUseCase(clinicalRepo, logger);
const updateDiagnosisUseCase = new UpdateDiagnosisUseCase(clinicalRepo, logger);
const getDiagnosesForPatientUseCase = new GetDiagnosesForPatientUseCase(
  clinicalRepo,
  logger,
);
const createAllergyUseCase = new CreateAllergyUseCase(clinicalRepo, logger);
const updateAllergyUseCase = new UpdateAllergyUseCase(clinicalRepo, logger);
const getAllergiesForPatientUseCase = new GetAllergiesForPatientUseCase(
  clinicalRepo,
  logger,
);
const createMedicationUseCase = new CreateMedicationUseCase(
  clinicalRepo,
  logger,
);
const updateMedicationUseCase = new UpdateMedicationUseCase(
  clinicalRepo,
  logger,
);
const getMedicationsForPatientUseCase = new GetMedicationsForPatientUseCase(
  clinicalRepo,
  logger,
);

// Diagnosis endpoints
clinicalRouter.post(
  "/diagnoses",
  requireRole("clinician", "admin"),
  validate({ body: createDiagnosisSchema }),
  async (req, res, next) => {
    try {
      const diagnosis = await createDiagnosisUseCase.execute(req.body);
      res.status(201).json(diagnosis.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalRouter.get(
  "/diagnoses/patient/:patientId",
  requireRole("clinician", "admin", "billing"),
  async (req, res, next) => {
    try {
      const diagnoses = await getDiagnosesForPatientUseCase.execute(
        req.params.patientId,
      );
      res.json({ diagnoses: diagnoses.map((d) => d.toJSON()) });
    } catch (error) {
      next(error);
    }
  },
);

clinicalRouter.patch(
  "/diagnoses/:id",
  requireRole("clinician", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ action: z.enum(["RESOLVE", "DEACTIVATE"]) }),
  }),
  async (req, res, next) => {
    try {
      const diagnosis = await updateDiagnosisUseCase.execute(
        req.params.id,
        req.body.action,
      );
      res.json(diagnosis.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

// Allergy endpoints
clinicalRouter.post(
  "/allergies",
  requireRole("clinician", "admin"),
  validate({ body: createAllergySchema }),
  async (req, res, next) => {
    try {
      const allergy = await createAllergyUseCase.execute(req.body);
      res.status(201).json(allergy.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalRouter.get(
  "/allergies/patient/:patientId",
  requireRole("clinician", "admin", "billing"),
  async (req, res, next) => {
    try {
      const allergies = await getAllergiesForPatientUseCase.execute(
        req.params.patientId,
      );
      res.json({ allergies: allergies.map((a) => a.toJSON()) });
    } catch (error) {
      next(error);
    }
  },
);

clinicalRouter.patch(
  "/allergies/:id",
  requireRole("clinician", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ action: z.enum(["DEACTIVATE", "RESOLVE"]) }),
  }),
  async (req, res, next) => {
    try {
      const allergy = await updateAllergyUseCase.execute(
        req.params.id,
        req.body.action,
      );
      res.json(allergy.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

// Medication endpoints
clinicalRouter.post(
  "/medications",
  requireRole("clinician", "admin"),
  validate({ body: createMedicationSchema }),
  async (req, res, next) => {
    try {
      const medication = await createMedicationUseCase.execute({
        ...req.body,
        startDate: new Date(req.body.startDate),
      });
      res.status(201).json(medication.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalRouter.get(
  "/medications/patient/:patientId",
  requireRole("clinician", "admin", "billing"),
  async (req, res, next) => {
    try {
      const medications = await getMedicationsForPatientUseCase.execute(
        req.params.patientId,
      );
      res.json({ medications: medications.map((m) => m.toJSON()) });
    } catch (error) {
      next(error);
    }
  },
);

clinicalRouter.patch(
  "/medications/:id",
  requireRole("clinician", "admin"),
  validate({
    params: z.object({ id: z.string().uuid() }),
    body: z.object({ action: z.enum(["DISCONTINUE", "ON_HOLD", "RESUME"]) }),
  }),
  async (req, res, next) => {
    try {
      const medication = await updateMedicationUseCase.execute(
        req.params.id,
        req.body.action,
      );
      res.json(medication.toJSON());
    } catch (error) {
      next(error);
    }
  },
);
