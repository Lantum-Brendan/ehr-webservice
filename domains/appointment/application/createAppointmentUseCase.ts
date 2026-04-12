import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import {
  IProviderScheduleRepository,
  IScheduleBlockRepository,
} from "../domain/scheduleRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import {
  NotFoundError,
  ConflictError,
  BadRequestError,
} from "@core/errors/appError.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

interface CreateAppointmentInput {
  patientId: string;
  providerId: string;
  appointmentTypeId: string;
  durationMinutes?: number;
  locationId?: string;
  scheduledStart: Date | string;
  reason?: string;
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

function subtractMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() - minutes * 60 * 1000);
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Invalid appointment creation";
}

export class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateAppointmentInput): Promise<Appointment> {
    this.logger.info({ input }, "Creating new appointment");

    const patient = await this.patientRepo.findById(input.patientId);
    if (!patient) {
      this.logger.warn({ patientId: input.patientId }, "Patient not found");
      throw new NotFoundError(`Patient with ID ${input.patientId} not found`);
    }

    const providerRecord = await prisma.provider.findUnique({
      where: { id: input.providerId },
    });
    if (!providerRecord) {
      throw new NotFoundError(`Provider with ID ${input.providerId} not found`);
    }
    if (!providerRecord.isActive) {
      throw new ConflictError("Provider is not available for appointments");
    }

    const typeRecord = await prisma.appointmentType.findUnique({
      where: { id: input.appointmentTypeId },
    });
    if (!typeRecord) {
      throw new NotFoundError("Appointment type not found");
    }
    if (!typeRecord.isActive) {
      throw new ConflictError("Appointment type is not available");
    }

    if (input.locationId) {
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

    const durationMinutes =
      input.durationMinutes ?? typeRecord.defaultDurationMinutes;

    let appointment: Appointment;
    try {
      appointment = Appointment.create({
        patientId: input.patientId,
        providerId: input.providerId,
        appointmentTypeId: input.appointmentTypeId,
        durationMinutes,
        locationId: input.locationId,
        scheduledStart: input.scheduledStart,
        reason: input.reason,
      });
    } catch (error) {
      throw new BadRequestError(getErrorMessage(error));
    }

    const schedules = await this.scheduleRepo.findByProviderAndDay(
      input.providerId,
      appointment.scheduledStart.getDay(),
    );
    const activeSchedules = schedules.filter((s) => s.isActive);

    if (activeSchedules.length === 0) {
      throw new ConflictError(
        "Provider is not available on this day. Please choose a different provider or day.",
      );
    }

    const workingHours = activeSchedules[0].getWorkingHoursForDate(
      appointment.scheduledStart,
    );
    if (!workingHours) {
      throw new ConflictError(
        "Provider is not available at this time. Please choose a different time.",
      );
    }

    if (
      appointment.scheduledStart < workingHours.start ||
      appointment.scheduledEnd > workingHours.end
    ) {
      throw new ConflictError(
        "Appointment falls outside provider's working hours.",
      );
    }

    const blocks = await this.blockRepo.findByProviderAndDateRange(
      input.providerId,
      new Date(appointment.scheduledStart.getTime() - 60 * 60 * 1000),
      new Date(appointment.scheduledEnd.getTime() + 60 * 60 * 1000),
    );

    const hasBlockConflict = blocks.some((block) =>
      block.overlapsWith(appointment.scheduledStart, appointment.scheduledEnd),
    );

    if (hasBlockConflict) {
      throw new ConflictError(
        "This time slot is blocked. Please choose a different time.",
      );
    }

    const settings = await prisma.clinicSettings.findFirst();
    const bufferMinutes = settings?.appointmentBufferMinutes ?? 0;

    const existingAppointments =
      await this.appointmentRepo.findOverlappingForProvider(
        input.providerId,
        subtractMinutes(appointment.scheduledStart, bufferMinutes),
        addMinutes(appointment.scheduledEnd, bufferMinutes),
      );

    const hasConflict = existingAppointments.some((apt) => apt.isActive);

    if (hasConflict) {
      this.logger.warn(
        {
          providerId: input.providerId,
          scheduledStart: appointment.scheduledStart,
          scheduledEnd: appointment.scheduledEnd,
          bufferMinutes,
        },
        "Time slot conflicts with existing appointment",
      );
      throw new ConflictError(
        "Time slot is not available. Please choose a different time.",
      );
    }

    await this.appointmentRepo.save(appointment);

    await this.eventBus.publish({
      type: "AppointmentCreated",
      aggregateId: appointment.id,
      aggregateType: "Appointment",
      occurredOn: new Date(),
      payload: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        scheduledStart: appointment.scheduledStart.toISOString(),
        status: appointment.status,
      },
    });

    this.logger.info(
      { appointmentId: appointment.id },
      "Appointment created successfully",
    );
    return appointment;
  }
}
