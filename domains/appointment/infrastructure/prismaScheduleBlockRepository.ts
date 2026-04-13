import { ScheduleBlock } from "../domain/scheduleBlock.js";
import type { IScheduleBlockRepository } from "../domain/scheduleRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaScheduleBlockRepository implements IScheduleBlockRepository {
  async findById(id: string): Promise<ScheduleBlock | null> {
    const record = await prisma.scheduleBlock.findUnique({ where: { id } });
    if (!record) return null;
    return ScheduleBlock.rehydrate({
      id: record.id,
      providerId: record.providerId,
      startDateTime: record.startDateTime,
      endDateTime: record.endDateTime,
      reason: record.reason,
    });
  }

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

  async save(block: ScheduleBlock): Promise<void> {
    const data = {
      id: block.id,
      providerId: block.providerId,
      startDateTime: block.startDateTime,
      endDateTime: block.endDateTime,
      reason: block.reason,
    };

    await prisma.scheduleBlock.upsert({
      where: { id: block.id },
      update: data,
      create: data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.scheduleBlock.delete({ where: { id } });
  }

  async deleteByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<number> {
    const result = await prisma.scheduleBlock.deleteMany({
      where: {
        providerId,
        startDateTime: { lt: endDate },
        endDateTime: { gt: startDate },
      },
    });
    return result.count;
  }
}
