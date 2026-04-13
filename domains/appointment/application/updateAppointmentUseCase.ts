import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import {
  IProviderScheduleRepository,
  IScheduleBlockRepository,
} from "../domain/scheduleRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import {
  BadRequestError,
  ConflictError,
  NotFoundError,
} from "@core/errors/appError.js";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { Prisma } from "@prisma/client";

interface UpdateAppointmentInput {
  appointmentTypeId?: string;
  durationMinutes?: number;
  locationId?: string;
  scheduledStart?: Date | string;
  reason?: string;
  notes?: string;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function subtractMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid appointment update";
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
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    input: UpdateAppointmentInput,
  ): Promise<Appointment> {
    this.logger.info({ appointmentId: id, input }, "Updating appointment");

    const currentAppointment = await this.appointmentRepo.findById(id);
    if (!currentAppointment) {
      this.logger.warn({ appointmentId: id }, "Appointment not found");
      throw new NotFoundError(`Appointment with ID ${id} not found`);
    }

    const hasScheduleChanges =
      input.appointmentTypeId !== undefined ||
      input.durationMinutes !== undefined ||
      input.locationId !== undefined ||
      input.scheduledStart !== undefined ||
      input.reason !== undefined;

    if (!currentAppointment.isActive) {
      throw new ConflictError("Cannot update appointment that is not active");
    }

    if (hasScheduleChanges && !currentAppointment.isCancellable) {
      throw new ConflictError(
        "Only scheduled or confirmed appointments can be rescheduled or modified",
      );
    }

    let resolvedDuration =
      input.durationMinutes ?? currentAppointment.durationMinutes;

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
        throw new NotFoundError(
          `Location with ID ${input.locationId} not found`,
        );
      }
      if (!locationRecord.isActive) {
        throw new ConflictError("Location is not available");
      }
    }

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

    const draft = Appointment.rehydrate(currentAppointment.toJSON());

    try {
      draft.updateDetails(appointmentUpdate);
    } catch (error) {
      throw new BadRequestError(getErrorMessage(error));
    }

    const shouldCheckConflicts =
      input.appointmentTypeId !== undefined ||
      input.durationMinutes !== undefined ||
      input.scheduledStart !== undefined;

    if (shouldCheckConflicts) {
      const schedules = await this.scheduleRepo.findByProviderAndDay(
        currentAppointment.providerId,
        draft.scheduledStart.getDay(),
      );
      const activeSchedules = schedules.filter((s) => s.isActive);

      if (activeSchedules.length === 0) {
        throw new ConflictError(
          "Provider is not available on this day. Please choose a different provider or day.",
        );
      }

      const isWithinWorkingHours = activeSchedules.some((schedule) =>
        schedule.coversInterval(draft.scheduledStart, draft.scheduledEnd),
      );

      if (!isWithinWorkingHours) {
        throw new ConflictError(
          "Appointment falls outside provider's working hours.",
        );
      }

      const blocks = await this.blockRepo.findByProviderAndDateRange(
        currentAppointment.providerId,
        new Date(draft.scheduledStart.getTime() - 60 * 60 * 1000),
        new Date(draft.scheduledEnd.getTime() + 60 * 60 * 1000),
      );

      const hasBlockConflict = blocks.some((block) =>
        block.overlapsWith(draft.scheduledStart, draft.scheduledEnd),
      );

      if (hasBlockConflict) {
        throw new ConflictError(
          "This time slot is blocked. Please choose a different time.",
        );
      }

      const settings = await prisma.clinicSettings.findFirst();
      const bufferMinutes = settings?.appointmentBufferMinutes ?? 0;

      try {
        await this.appointmentRepo.withSerializableTransaction(async (repo) => {
          const existingAppointments = await repo.findOverlappingForProvider(
            currentAppointment.providerId,
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

          await repo.save(draft);
        });
      } catch (error) {
        if (isSerializableTransactionConflict(error)) {
          throw new ConflictError(
            "Time slot is no longer available. Please choose a different time.",
          );
        }

        throw error;
      }
    } else {
      await this.appointmentRepo.save(draft);
    }

    currentAppointment.updateDetails({
      ...appointmentUpdate,
      now: draft.updatedAt,
    });

    await this.eventBus.publish({
      type: "AppointmentUpdated",
      aggregateId: currentAppointment.id,
      aggregateType: "Appointment",
      occurredOn: new Date(),
      payload: {
        appointmentId: currentAppointment.id,
        updates: input,
        scheduledStart: currentAppointment.scheduledStart.toISOString(),
        scheduledEnd: currentAppointment.scheduledEnd.toISOString(),
        durationMinutes: currentAppointment.durationMinutes,
        appointmentTypeId: currentAppointment.appointmentTypeId,
        locationId: currentAppointment.locationId,
        reason: currentAppointment.reason,
        notes: currentAppointment.notes,
      },
    });

    this.logger.info(
      { appointmentId: currentAppointment.id },
      "Appointment updated successfully",
    );

    return currentAppointment;
  }
}
