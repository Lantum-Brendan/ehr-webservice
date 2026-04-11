import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { Prisma } from "@prisma/client";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@core/errors/appError.js";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { getAppointmentClinicSettings } from "../infrastructure/appointmentClinicSettings.js";

interface UpdateAppointmentInput {
  appointmentTypeId?: string;
  durationMinutes?: number;
  locationId?: string;
  scheduledStart?: Date | string;
  reason?: string;
  notes?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid appointment update";
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function subtractMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

function isSerializableTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

export class UpdateAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<Appointment> {
    this.logger.info({ appointmentId: id, input }, "Updating appointment");
    const now = new Date();

    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      this.logger.warn({ appointmentId: id }, "Appointment not found");
      throw new NotFoundError(`Appointment with ID ${id} not found`);
    }

    const hasScheduleChanges =
      input.appointmentTypeId !== undefined ||
      input.durationMinutes !== undefined ||
      input.locationId !== undefined ||
      input.scheduledStart !== undefined ||
      input.reason !== undefined;

    if (!appointment.isActive) {
      throw new ConflictError("Cannot update appointment that is not active");
    }

    if (hasScheduleChanges && !appointment.isCancellable) {
      throw new ConflictError(
        "Only scheduled or confirmed appointments can be rescheduled or modified",
      );
    }

    let resolvedDuration = input.durationMinutes ?? appointment.durationMinutes;

    if (input.appointmentTypeId !== undefined) {
      const typeRecord = await prisma.appointmentType.findUnique({
        where: { id: input.appointmentTypeId },
      });
      if (!typeRecord) {
        throw new NotFoundError("Appointment type not found");
      }
      if (!typeRecord.isActive) {
        throw new ConflictError("Appointment type is not available");
      }
      resolvedDuration =
        input.durationMinutes ?? typeRecord.defaultDurationMinutes;
    }

    if (input.locationId !== undefined) {
      const locationRecord = await prisma.location.findUnique({
        where: { id: input.locationId },
      });
      if (!locationRecord) {
        throw new NotFoundError(`Location with ID ${input.locationId} not found`);
      }
      if (!locationRecord.isActive) {
        throw new ConflictError("Location is not available");
      }
    }

    const draft = Appointment.rehydrate(appointment.toJSON());
    const appointmentUpdate: Parameters<Appointment["updateDetails"]>[0] = {};

    if (input.appointmentTypeId !== undefined) {
      appointmentUpdate.appointmentTypeId = input.appointmentTypeId;
      appointmentUpdate.durationMinutes = resolvedDuration;
    } else if (input.durationMinutes !== undefined) {
      appointmentUpdate.durationMinutes = resolvedDuration;
    }

    if (input.locationId !== undefined) {
      appointmentUpdate.locationId = input.locationId;
    }

    if (input.scheduledStart !== undefined) {
      appointmentUpdate.scheduledStart = input.scheduledStart;
    }

    if (input.reason !== undefined) {
      appointmentUpdate.reason = input.reason;
    }

    if (input.notes !== undefined) {
      appointmentUpdate.notes = input.notes;
    }

    try {
      draft.updateDetails({
        ...appointmentUpdate,
        now,
      });
    } catch (error) {
      throw new BadRequestError(getErrorMessage(error));
    }

    const shouldCheckConflicts =
      input.appointmentTypeId !== undefined ||
      input.durationMinutes !== undefined ||
      input.scheduledStart !== undefined;

    const settings = shouldCheckConflicts
      ? await getAppointmentClinicSettings()
      : null;

    try {
      await this.appointmentRepo.withSerializableTransaction(async (repo) => {
        if (shouldCheckConflicts) {
          const bufferMinutes = settings?.appointmentBufferMinutes ?? 0;

          const existingAppointments = await repo.findOverlappingForProvider(
            appointment.providerId,
            subtractMinutes(draft.scheduledStart, bufferMinutes),
            addMinutes(draft.scheduledEnd, bufferMinutes),
          );

          const hasConflict = existingAppointments.some(
            (apt) => apt.id !== id && apt.isActive,
          );

          if (hasConflict) {
            throw new ConflictError(
              "Time slot is not available. Please choose a different time.",
            );
          }
        }

        appointment.updateDetails({
          ...appointmentUpdate,
          now,
        });

        await repo.save(appointment);
      });
    } catch (error) {
      if (isSerializableTransactionConflict(error)) {
        throw new ConflictError(
          "Time slot is no longer available. Please choose a different time.",
        );
      }

      throw error;
    }

    await this.eventBus.publish({
      type: "AppointmentUpdated",
      aggregateId: appointment.id,
      aggregateType: "Appointment",
      occurredOn: new Date(),
      payload: {
        appointmentId: appointment.id,
        updates: input,
        scheduledStart: appointment.scheduledStart.toISOString(),
        scheduledEnd: appointment.scheduledEnd.toISOString(),
        durationMinutes: appointment.durationMinutes,
        appointmentTypeId: appointment.appointmentTypeId,
        locationId: appointment.locationId,
        reason: appointment.reason,
        notes: appointment.notes,
      },
    });

    this.logger.info(
      { appointmentId: appointment.id },
      "Appointment updated successfully",
    );

    return appointment;
  }
}
