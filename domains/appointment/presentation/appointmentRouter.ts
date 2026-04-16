import { Router } from "express";
import { z } from "zod";
import { requireRole } from "@core/guards/roleGuard.js";
import { ForbiddenError } from "@core/errors/appError.ts";
import { CreateAppointmentUseCase } from "../application/createAppointmentUseCase.js";
import { UpdateAppointmentUseCase } from "../application/updateAppointmentUseCase.js";
import { CancelAppointmentUseCase } from "../application/cancelAppointmentUseCase.js";
import { GetAppointmentUseCase } from "../application/getAppointmentUseCase.js";
import { GetAppointmentsForPatientUseCase } from "../application/getAppointmentsForPatientUseCase.js";
import { PrismaAppointmentRepository } from "../infrastructure/prismaAppointmentRepository.js";
import { Appointment } from "../domain/appointmentEntity.js";
import { PrismaPatientRepository } from "@domains/patient/infrastructure/prismaPatientRepository.js";
import { InMemoryEventBus } from "@shared/event-bus/event-bus.interface.js";
import { logger } from "@shared/logger/index.js";
import {
  toAppointmentCancellationDto,
  toAppointmentDto,
  toAppointmentListItemDto,
} from "./appointmentDto.js";

const idSchema = z.string().trim().min(1);

const createAppointmentSchema = z.object({
  patientId: idSchema,
  providerId: idSchema,
  appointmentTypeId: idSchema,
  durationMinutes: z.number().positive().optional(),
  locationId: idSchema.optional(),
  scheduledStart: z.string().datetime(),
  reason: z.string().optional(),
});

const updateAppointmentSchema = z
  .object({
    appointmentTypeId: idSchema.optional(),
    durationMinutes: z.number().positive().optional(),
    locationId: idSchema.optional(),
    scheduledStart: z.string().datetime().optional(),
    reason: z.string().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const cancelAppointmentSchema = z.object({
  reason: z.string().optional(),
});

const appointmentRepo = new PrismaAppointmentRepository();
const patientRepo = new PrismaPatientRepository();
const eventBus = new InMemoryEventBus();

const createAppointmentUseCase = new CreateAppointmentUseCase(
  appointmentRepo,
  patientRepo,
  eventBus,
  logger,
);

const updateAppointmentUseCase = new UpdateAppointmentUseCase(
  appointmentRepo,
  eventBus,
  logger,
);

const cancelAppointmentUseCase = new CancelAppointmentUseCase(
  appointmentRepo,
  eventBus,
  logger,
);

const getAppointmentUseCase = new GetAppointmentUseCase(appointmentRepo);

const getAppointmentsForPatientUseCase = new GetAppointmentsForPatientUseCase(
  appointmentRepo,
  patientRepo,
);

function assertPatientOwnsAppointment(
  userId: string | undefined,
  appointment: Appointment,
) {
  if (!userId || appointment.patientId !== userId) {
    throw new ForbiddenError("Access denied");
  }
}

export const appointmentRouter = Router();

appointmentRouter.post(
  "/",
  requireRole("admin", "reception", "clinician"),
  async (req, res, next) => {
    try {
      const input = createAppointmentSchema.parse(req.body);
      const appointment = await createAppointmentUseCase.execute(input);
      res.status(201).json(toAppointmentDto(appointment));
    } catch (error) {
      next(error);
    }
  },
);

appointmentRouter.get(
  "/:id",
  requireRole("admin", "reception", "clinician", "patient"),
  async (req, res, next) => {
    try {
      const appointment = await getAppointmentUseCase.execute(req.params.id);
      const isPatientUser = req.user?.roles?.includes("patient") ?? false;

      if (isPatientUser) {
        assertPatientOwnsAppointment(req.user?.id, appointment);
      }

      res.json(toAppointmentDto(appointment));
    } catch (error) {
      next(error);
    }
  },
);

appointmentRouter.put(
  "/:id",
  requireRole("admin", "reception", "clinician"),
  async (req, res, next) => {
    try {
      const input = updateAppointmentSchema.parse(req.body);
      const appointment = await updateAppointmentUseCase.execute(
        req.params.id,
        input,
      );
      res.json(toAppointmentDto(appointment));
    } catch (error) {
      next(error);
    }
  },
);

appointmentRouter.put(
  "/:id/cancel",
  requireRole("admin", "reception", "clinician", "patient"),
  async (req, res, next) => {
    try {
      const input = cancelAppointmentSchema.parse(req.body);
      const isPatientCancel = req.user?.roles?.includes("patient") ?? false;
      const cancelledBy = req.user?.id ?? "unknown";
      let preloadedAppointment: Appointment | undefined;

      if (isPatientCancel) {
        preloadedAppointment = await getAppointmentUseCase.execute(
          req.params.id,
        );
        assertPatientOwnsAppointment(req.user?.id, preloadedAppointment);
      }

      const appointment = await cancelAppointmentUseCase.execute(
        req.params.id,
        {
          cancelledBy,
          reason: input.reason,
          isPatientCancel,
        },
        preloadedAppointment,
      );

      res.json(toAppointmentCancellationDto(appointment));
    } catch (error) {
      next(error);
    }
  },
);

appointmentRouter.get(
  "/patient/:patientId",
  requireRole("admin", "reception", "clinician", "patient"),
  async (req, res, next) => {
    try {
      const isPatientUser = req.user?.roles?.includes("patient") ?? false;
      if (isPatientUser && req.user?.id !== req.params.patientId) {
        res.status(403).json({ error: { message: "Access denied" } });
        return;
      }

      const appointments = await getAppointmentsForPatientUseCase.execute(
        req.params.patientId,
      );

      res.json({
        appointments: appointments.map(toAppointmentListItemDto),
      });
    } catch (error) {
      next(error);
    }
  },
);
