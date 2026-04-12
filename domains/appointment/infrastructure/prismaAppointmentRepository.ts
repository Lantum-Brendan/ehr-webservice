import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaAppointmentRepository implements IAppointmentRepository {
  private mapToAppointment(record: any): Appointment | null {
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

  async findById(id: string): Promise<Appointment | null> {
    const record = await prisma.appointment.findUnique({
      where: { id },
    });

    return this.mapToAppointment(record);
  }

  async findByPatientId(patientId: string): Promise<Appointment[]> {
    const records = await prisma.appointment.findMany({
      where: { patientId },
      orderBy: { scheduledStart: "asc" },
    });

    return records
      .map((record) => this.mapToAppointment(record))
      .filter(Boolean) as Appointment[];
  }

  async findByProviderId(providerId: string): Promise<Appointment[]> {
    const records = await prisma.appointment.findMany({
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
    const records = await prisma.appointment.findMany({
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
    const records = await prisma.appointment.findMany({
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
    const records = await prisma.appointment.findMany({
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

  async save(appointment: Appointment): Promise<void> {
    const data = appointment.toJSON();

    await prisma.appointment.upsert({
      where: { id: appointment.id },
      update: {
        locationId: data.locationId,
        scheduledStart: data.scheduledStart,
        scheduledEnd: data.scheduledEnd,
        status: data.status,
        reason: data.reason,
        notes: data.notes,
        cancelledAt: data.cancelledAt,
        cancelledBy: data.cancelledBy,
        cancelledReason: data.cancelledReason,
        updatedAt: new Date(),
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
    await prisma.appointment.delete({
      where: { id },
    });
  }
}
