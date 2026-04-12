import { ScheduleBlock } from "../domain/scheduleBlock.js";
import type { IScheduleBlockRepository } from "../domain/scheduleRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaScheduleBlockRepository implements IScheduleBlockRepository {
  async findByProviderId(providerId: string): Promise<ScheduleBlock[]> {
    const records = await prisma.scheduleBlock.findMany({
      where: { providerId },
      orderBy: { startDateTime: "asc" },
    });

    return records.map((record) =>
      ScheduleBlock.rehydrate({
        id: record.id,
        providerId: record.providerId,
        startDateTime: record.startDateTime,
        endDateTime: record.endDateTime,
        reason: record.reason,
      }),
    );
  }

  async findByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ScheduleBlock[]> {
    const records = await prisma.scheduleBlock.findMany({
      where: {
        providerId,
        startDateTime: { lt: endDate },
        endDateTime: { gt: startDate },
      },
      orderBy: { startDateTime: "asc" },
    });

    return records.map((record) =>
      ScheduleBlock.rehydrate({
        id: record.id,
        providerId: record.providerId,
        startDateTime: record.startDateTime,
        endDateTime: record.endDateTime,
        reason: record.reason,
      }),
    );
  }
}
