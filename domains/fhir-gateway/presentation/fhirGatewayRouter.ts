import { NextFunction, Request, Response, Router } from "express";
import { ZodError, z } from "zod";
import { AppError } from "@core/errors/appError.js";
import { requireRole } from "@core/guards/roleGuard.js";
import { validate } from "@core/middleware/validateMiddleware.js";
import { PrismaAppointmentRepository } from "@domains/appointment/infrastructure/prismaAppointmentRepository.js";
import { PrismaEncounterRepository } from "@domains/encounter/infrastructure/prismaEncounterRepository.js";
import { PrismaPatientRepository } from "@domains/patient/infrastructure/prismaPatientRepository.js";
import {
  FhirGatewayService,
  toOperationOutcome,
} from "../application/fhirGatewayService.js";

const patientRepo = new PrismaPatientRepository();
const appointmentRepo = new PrismaAppointmentRepository();
const encounterRepo = new PrismaEncounterRepository();

const fhirGatewayService = new FhirGatewayService(
  patientRepo,
  appointmentRepo,
  encounterRepo,
);

const idParamsSchema = z.object({
  id: z.string().trim().min(1, "Resource ID is required"),
});

const patientSearchSchema = z.object({
  _id: z.string().trim().min(1).optional(),
  identifier: z.string().trim().min(1).optional(),
  family: z.string().trim().min(1).optional(),
  given: z.string().trim().min(1).optional(),
});

const appointmentSearchSchema = z.object({
  _id: z.string().trim().min(1).optional(),
  patient: z.string().trim().min(1).optional(),
  actor: z.string().trim().min(1).optional(),
});

const encounterSearchSchema = z.object({
  _id: z.string().trim().min(1).optional(),
  patient: z.string().trim().min(1).optional(),
  appointment: z.string().trim().min(1).optional(),
  practitioner: z.string().trim().min(1).optional(),
});

export const fhirGatewayRouter = Router();

fhirGatewayRouter.use(
  requireRole("admin", "clinician", "billing", "reception"),
);

fhirGatewayRouter.get("/metadata", (_req, res) => {
  res.json(fhirGatewayService.getCapabilityStatement());
});

fhirGatewayRouter.get(
  "/Patient",
  validate({ query: patientSearchSchema }),
  async (req, res, next) => {
    try {
      const bundle = await fhirGatewayService.searchPatients(req.query);
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  },
);

fhirGatewayRouter.get(
  "/Patient/:id",
  validate({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const resource = await fhirGatewayService.readPatient(req.params.id);
      res.json(resource);
    } catch (error) {
      next(error);
    }
  },
);

fhirGatewayRouter.get(
  "/Appointment",
  validate({ query: appointmentSearchSchema }),
  async (req, res, next) => {
    try {
      const bundle = await fhirGatewayService.searchAppointments(req.query);
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  },
);

fhirGatewayRouter.get(
  "/Appointment/:id",
  validate({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const resource = await fhirGatewayService.readAppointment(req.params.id);
      res.json(resource);
    } catch (error) {
      next(error);
    }
  },
);

fhirGatewayRouter.get(
  "/Encounter",
  validate({ query: encounterSearchSchema }),
  async (req, res, next) => {
    try {
      const bundle = await fhirGatewayService.searchEncounters(req.query);
      res.json(bundle);
    } catch (error) {
      next(error);
    }
  },
);

fhirGatewayRouter.get(
  "/Encounter/:id",
  validate({ params: idParamsSchema }),
  async (req, res, next) => {
    try {
      const resource = await fhirGatewayService.readEncounter(req.params.id);
      res.json(resource);
    } catch (error) {
      next(error);
    }
  },
);

fhirGatewayRouter.use(
  (
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void => {
    if (err instanceof AppError) {
      res
        .status(err.statusCode)
        .json(toOperationOutcome(err.message, err.code.toLowerCase()));
      return;
    }

    if (err instanceof ZodError) {
      res.status(422).json(
        toOperationOutcome(
          err.errors.map((issue) => issue.message).join("; "),
          "invalid",
        ),
      );
      return;
    }

    res.status(500).json(
      toOperationOutcome("Something went wrong", "exception"),
    );
  },
);
