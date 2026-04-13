import { ProviderSchedule } from "../domain/providerSchedule.js";
import type { IProviderScheduleRepository } from "../domain/scheduleRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaProviderScheduleRepository implements IProviderScheduleRepository {
  async findById(id: string): Promise<ProviderSchedule | null> {
    const record = await prisma.providerSchedule.findUnique({ where: { id } });
    if (!record) return null;
    return ProviderSchedule.rehydrate({
      id: record.id,
      providerId: record.providerId,
      dayOfWeek: record.dayOfWeek,
      startTime: record.startTime,
      endTime: record.endTime,
      isActive: record.isActive,
    });
  }

  async findByProviderId(providerId: string): Promise<ProviderSchedule[]> {
    const records = await prisma.providerSchedule.findMany({
      where: { providerId },
      orderBy: [{ dayOfWeek: "asc" }, { startTime: "asc" }],
    });

    return records.map((record) =>
      ProviderSchedule.rehydrate({
        id: record.id,
        providerId: record.providerId,
        dayOfWeek: record.dayOfWeek,
        startTime: record.startTime,
        endTime: record.endTime,
        isActive: record.isActive,
      }),
    );
  }

  async findByProviderAndDay(
    providerId: string,
    dayOfWeek: number,
  ): Promise<ProviderSchedule[]> {
    const records = await prisma.providerSchedule.findMany({
      where: { providerId, dayOfWeek },
      orderBy: { startTime: "asc" },
    });

    return records.map((record) =>
      ProviderSchedule.rehydrate({
        id: record.id,
        providerId: record.providerId,
        dayOfWeek: record.dayOfWeek,
        startTime: record.startTime,
        endTime: record.endTime,
        isActive: record.isActive,
      }),
    );
  }

  async save(schedule: ProviderSchedule): Promise<void> {
    const data = {
      id: schedule.id,
      providerId: schedule.providerId,
      dayOfWeek: schedule.dayOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      isActive: schedule.isActive,
    };

    await prisma.providerSchedule.upsert({
      where: { id: schedule.id },
      update: data,
      create: data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.providerSchedule.delete({ where: { id } });
  }
}
