import { prisma } from "@infrastructure/database/prisma.client.js";
import { Encounter } from "../domain/encounterEntity.js";
import { type IEncounterRepository } from "../domain/encounterRepository.js";

export class PrismaEncounterRepository implements IEncounterRepository {
  async findById(id: string): Promise<Encounter | null> {
    const record = await prisma.encounter.findUnique({ where: { id } });
    if (!record) return null;
    return Encounter.rehydrate({
      id: record.id,
      patientId: record.patientId,
      encounterType: record.encounterType,
      startTime: record.startTime,
      endTime: record.endTime,
      status: record.status,
    });
  }

  async findByPatientId(patientId: string): Promise<Encounter[]> {
    const records = await prisma.encounter.findMany({
      where: { patientId },
      orderBy: { startTime: "desc" },
    });
    return records.map((record) =>
      Encounter.rehydrate({
        id: record.id,
        patientId: record.patientId,
        encounterType: record.encounterType,
        startTime: record.startTime,
        endTime: record.endTime,
        status: record.status,
      }),
    );
  }

  async findByProviderId(providerId: string): Promise<Encounter[]> {
    const records = await prisma.encounter.findMany({
      where: { providerId },
      orderBy: { startTime: "desc" },
    });
    return records.map((record) =>
      Encounter.rehydrate({
        id: record.id,
        patientId: record.patientId,
        encounterType: record.encounterType,
        startTime: record.startTime,
        endTime: record.endTime,
        status: record.status,
      }),
    );
  }

  async findByDateRange(startDate: Date, endDate: Date): Promise<Encounter[]> {
    const records = await prisma.encounter.findMany({
      where: {
        startTime: { gte: startDate, lte: endDate },
      },
      orderBy: { startTime: "desc" },
    });
    return records.map((record) =>
      Encounter.rehydrate({
        id: record.id,
        patientId: record.patientId,
        encounterType: record.encounterType,
        startTime: record.startTime,
        endTime: record.endTime,
        status: record.status,
      }),
    );
  }

  async findByAppointmentId(appointmentId: string): Promise<Encounter | null> {
    const record = await prisma.encounter.findFirst({
      where: { appointmentId },
    });
    if (!record) return null;
    return Encounter.rehydrate({
      id: record.id,
      patientId: record.patientId,
      encounterType: record.encounterType,
      startTime: record.startTime,
      endTime: record.endTime,
      status: record.status,
    });
  }

  async save(encounter: Encounter): Promise<void> {
    const data = {
      id: encounter.id,
      patientId: encounter.patientId,
      encounterType: encounter.encounterTypeValue,
      startTime: encounter.startTimeValue,
      endTime: encounter.endTimeValue,
      status: encounter.statusValue,
    };

    await prisma.encounter.upsert({
      where: { id: encounter.id },
      update: data,
      create: data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.encounter.delete({ where: { id } });
  }
}
