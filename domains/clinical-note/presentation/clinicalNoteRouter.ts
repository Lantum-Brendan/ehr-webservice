import { Router } from "express";
import { z } from "zod";
import { requireRole } from "@core/guards/roleGuard.js";
import { ForbiddenError } from "@core/errors/appError.js";
import { CreateClinicalNoteUseCase } from "../application/createClinicalNoteUseCase.js";
import { SignClinicalNoteUseCase } from "../application/signClinicalNoteUseCase.js";
import { UpdateClinicalNoteUseCase } from "../application/updateClinicalNoteUseCase.js";
import {
  GetClinicalNoteUseCase,
  GetClinicalNotesForEncounterUseCase,
  GetClinicalNotesForPatientUseCase,
  GetSignedClinicalNotesForPatientUseCase,
} from "../application/getClinicalNoteUseCase.js";
import { PrismaClinicalNoteRepository } from "../infrastructure/prismaClinicalNoteRepository.js";
import { PrismaEncounterRepository } from "@domains/encounter/infrastructure/prismaEncounterRepository.js";
import { InMemoryEventBus } from "@shared/event-bus/event-bus.interface.js";
import { logger } from "@shared/logger/index.js";

const idSchema = z.string().trim().min(1);

const createClinicalNoteSchema = z.object({
  encounterId: idSchema,
  patientId: idSchema,
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

const updateClinicalNoteSchema = z.object({
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

const noteRepo = new PrismaClinicalNoteRepository();
const encounterRepo = new PrismaEncounterRepository();
const eventBus = new InMemoryEventBus();

const createClinicalNoteUseCase = new CreateClinicalNoteUseCase(
  noteRepo,
  encounterRepo,
  eventBus,
  logger,
);

const signClinicalNoteUseCase = new SignClinicalNoteUseCase(
  noteRepo,
  eventBus,
  logger,
);

const updateClinicalNoteUseCase = new UpdateClinicalNoteUseCase(
  noteRepo,
  eventBus,
  logger,
);

const getClinicalNoteUseCase = new GetClinicalNoteUseCase(noteRepo);
const getClinicalNotesForEncounterUseCase =
  new GetClinicalNotesForEncounterUseCase(noteRepo);
const getClinicalNotesForPatientUseCase = new GetClinicalNotesForPatientUseCase(
  noteRepo,
);
const getSignedClinicalNotesForPatientUseCase =
  new GetSignedClinicalNotesForPatientUseCase(noteRepo);

export const clinicalNoteRouter = Router();

clinicalNoteRouter.post(
  "/",
  requireRole("clinician"),
  async (req, res, next) => {
    try {
      const input = createClinicalNoteSchema.parse(req.body);
      const authorId = req.user?.id;

      if (!authorId) {
        throw new ForbiddenError("Author ID not found in token");
      }

      const note = await createClinicalNoteUseCase.execute({
        ...input,
        authorId,
      });

      res.status(201).json(note.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalNoteRouter.put(
  "/:id",
  requireRole("clinician"),
  async (req, res, next) => {
    try {
      const input = updateClinicalNoteSchema.parse(req.body);
      const authorId = req.user?.id;

      if (!authorId) {
        throw new ForbiddenError("Author ID not found in token");
      }

      const note = await updateClinicalNoteUseCase.execute(
        req.params.id,
        authorId,
        input,
      );

      res.json(note.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalNoteRouter.put(
  "/:id/sign",
  requireRole("clinician"),
  async (req, res, next) => {
    try {
      const authorId = req.user?.id;

      if (!authorId) {
        throw new ForbiddenError("Author ID not found in token");
      }

      const note = await signClinicalNoteUseCase.execute(
        req.params.id,
        authorId,
      );

      res.json(note.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalNoteRouter.get(
  "/:id",
  requireRole("admin", "reception", "clinician", "patient"),
  async (req, res, next) => {
    try {
      const note = await getClinicalNoteUseCase.execute(req.params.id);
      const isPatientUser = req.user?.roles?.includes("patient") ?? false;

      if (isPatientUser) {
        if (!note.isSigned() || note.patientId !== req.user?.id) {
          throw new ForbiddenError("Access denied");
        }
      }

      res.json(note.toJSON());
    } catch (error) {
      next(error);
    }
  },
);

clinicalNoteRouter.get(
  "/encounter/:encounterId",
  requireRole("admin", "reception", "clinician"),
  async (req, res, next) => {
    try {
      const notes = await getClinicalNotesForEncounterUseCase.execute(
        req.params.encounterId,
      );

      res.json(notes.map((n) => n.toJSON()));
    } catch (error) {
      next(error);
    }
  },
);

clinicalNoteRouter.get(
  "/patient/:patientId",
  requireRole("admin", "reception", "clinician", "patient"),
  async (req, res, next) => {
    try {
      const isPatientUser = req.user?.roles?.includes("patient") ?? false;

      let notes;
      if (isPatientUser) {
        if (req.user?.id !== req.params.patientId) {
          throw new ForbiddenError("Access denied");
        }
        notes = await getSignedClinicalNotesForPatientUseCase.execute(
          req.params.patientId,
        );
      } else {
        notes = await getClinicalNotesForPatientUseCase.execute(
          req.params.patientId,
        );
      }

      res.json(notes.map((n) => n.toJSON()));
    } catch (error) {
      next(error);
    }
  },
);
