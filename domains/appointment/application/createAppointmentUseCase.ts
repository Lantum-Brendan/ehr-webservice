import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { Prisma } from "@prisma/client";
import {
  BadRequestError,
  NotFoundError,
  ConflictError,
} from "@core/errors/appError.ts";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { getAppointmentClinicSettings } from "../infrastructure/appointmentClinicSettings.js";

interface CreateAppointmentInput {
  patientId: string;
  providerId: string;
  appointmentTypeId: string;
  durationMinutes?: number;
  locationId?: string;
  scheduledStart: Date | string;
  reason?: string;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid appointment input";
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

export class CreateAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateAppointmentInput): Promise<Appointment> {
    this.logger.info({ input }, "Creating new appointment");
    const now = new Date();

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
        now,
      });
    } catch (error) {
      throw new BadRequestError(getErrorMessage(error));
    }

    const settings = await getAppointmentClinicSettings();
    const bufferMinutes = settings.appointmentBufferMinutes;

    try {
      await this.appointmentRepo.withSerializableTransaction(async (repo) => {
        const existingAppointments = await repo.findOverlappingForProvider(
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
      type: "AppointmentCreated",
      aggregateId: appointment.id,
      aggregateType: "Appointment",
      occurredOn: new Date(),
      payload: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        scheduledStart: appointment.scheduledStart.toISOString(),
        scheduledEnd: appointment.scheduledEnd.toISOString(),
        durationMinutes: appointment.durationMinutes,
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
