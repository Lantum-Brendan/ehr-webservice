import { ProviderSchedule } from "../domain/providerSchedule.js";
import type { IProviderScheduleRepository } from "../domain/scheduleRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaProviderScheduleRepository implements IProviderScheduleRepository {
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
}
