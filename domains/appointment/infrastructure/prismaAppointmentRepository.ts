import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { Prisma, PrismaClient } from "@prisma/client";

type AppointmentDbClient = PrismaClient | Prisma.TransactionClient;

export class PrismaAppointmentRepository implements IAppointmentRepository {
  constructor(private readonly db: AppointmentDbClient = prisma) {}

  private mapToAppointment(
    record: Awaited<
      ReturnType<AppointmentDbClient["appointment"]["findUnique"]>
    >,
  ): Appointment | null {
    if (!record) {
      return null;
    }

    return Appointment.rehydrate({
      id: record.id,
      patientId: record.patientId,
      providerId: record.providerId,
      appointmentTypeId: record.appointmentTypeId,
      durationMinutes: record.durationMinutes,
      locationId: record.locationId,
      scheduledStart: record.scheduledStart,
      scheduledEnd: record.scheduledEnd,
      status: record.status,
      reason: record.reason,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      cancelledAt: record.cancelledAt,
      cancelledBy: record.cancelledBy,
      cancelledReason: record.cancelledReason,
    });
  }

  private isRootClient(): boolean {
    return "$transaction" in this.db;
  }

  async findById(id: string): Promise<Appointment | null> {
    const record = await this.db.appointment.findUnique({
      where: { id },
    });

    return this.mapToAppointment(record);
  }

  async findByPatientId(patientId: string): Promise<Appointment[]> {
    const records = await this.db.appointment.findMany({
      where: { patientId },
      orderBy: { scheduledStart: "asc" },
    });

    return records
      .map((record) => this.mapToAppointment(record))
      .filter(Boolean) as Appointment[];
  }

  async findByProviderId(providerId: string): Promise<Appointment[]> {
    const records = await this.db.appointment.findMany({
      where: { providerId },
      orderBy: { scheduledStart: "asc" },
    });

    return records
      .map((record) => this.mapToAppointment(record))
      .filter(Boolean) as Appointment[];
  }

  async findByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    const records = await this.db.appointment.findMany({
      where: {
        scheduledStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { scheduledStart: "asc" },
    });

    return records
      .map((record) => this.mapToAppointment(record))
      .filter(Boolean) as Appointment[];
  }

  async findByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    const records = await this.db.appointment.findMany({
      where: {
        providerId,
        scheduledStart: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { scheduledStart: "asc" },
    });

    return records
      .map((record) => this.mapToAppointment(record))
      .filter(Boolean) as Appointment[];
  }

  async findOverlappingForProvider(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]> {
    const records = await this.db.appointment.findMany({
      where: {
        providerId,
        scheduledStart: { lt: endDate },
        scheduledEnd: { gt: startDate },
      },
      orderBy: { scheduledStart: "asc" },
    });

    return records
      .map((record) => this.mapToAppointment(record))
      .filter(Boolean) as Appointment[];
  }

  async withSerializableTransaction<T>(
    operation: (repository: IAppointmentRepository) => Promise<T>,
  ): Promise<T> {
    if (!this.isRootClient()) {
      return operation(this);
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        if (!this.isRootClient()) throw new Error("Cannot start a transaction from within a transaction");
return await (this.db as PrismaClient).$transaction(
          async (tx: Prisma.TransactionClient) =>
            operation(new PrismaAppointmentRepository(tx)),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
          },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        ) {
          continue;
        }

        throw error;
      }
    }

    throw new Error("Unreachable transaction retry state");
  }

  async save(appointment: Appointment): Promise<void> {
    const data = appointment.toJSON();

    await this.db.appointment.upsert({
      where: { id: appointment.id },
      update: {
        appointmentTypeId: data.appointmentTypeId,
        durationMinutes: data.durationMinutes,
        locationId: data.locationId,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
        status: data.status,
        reason: data.reason,
        notes: data.notes,
        cancelledAt: data.cancelledAt,
        cancelledBy: data.cancelledBy,
        cancelledReason: data.cancelledReason,
        updatedAt: data.updatedAt,
      },
      create: {
        id: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        appointmentTypeId: appointment.appointmentTypeId,
        durationMinutes: appointment.durationMinutes,
        locationId: data.locationId,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
        status: data.status,
        reason: data.reason,
        notes: data.notes,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await this.db.appointment.delete({
      where: { id },
    });
  }
}
