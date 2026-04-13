import { ScheduleBlock } from "../domain/scheduleBlock.js";
import {
  type IScheduleBlockRepository,
  type IProviderScheduleRepository,
} from "../domain/scheduleRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ConflictError } from "@core/errors/appError.js";

interface CreateBlockInput {
  providerId: string;
  startDateTime: Date | string;
  endDateTime: Date | string;
  reason: string;
}

export class CreateBlockUseCase {
  constructor(
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateBlockInput): Promise<ScheduleBlock> {
    this.logger.info(
      { providerId: input.providerId },
      "Creating schedule block",
    );

    const startDate =
      typeof input.startDateTime === "string"
        ? new Date(input.startDateTime)
        : input.startDateTime;
    const endDate =
      typeof input.endDateTime === "string"
        ? new Date(input.endDateTime)
        : input.endDateTime;

    const existingSchedules = await this.scheduleRepo.findByProviderId(
      input.providerId,
    );
    const conflicts: string[] = [];

    for (const schedule of existingSchedules) {
      const scheduleStart = schedule.getWorkingHoursForDate(startDate);
      if (scheduleStart) {
        if (startDate < scheduleStart.end && endDate > scheduleStart.start) {
          conflicts.push(
            `Blocks schedule on day ${schedule.dayOfWeek} (${schedule.startTime}-${schedule.endTime})`,
          );
        }
      }
    }

    if (conflicts.length > 0) {
      this.logger.warn({ conflicts }, "Block overlaps with schedules");
    }

    const block = ScheduleBlock.create({
      providerId: input.providerId,
      startDateTime: startDate,
      endDateTime: endDate,
      reason: input.reason,
    });

    await this.blockRepo.save(block);

    this.logger.info({ blockId: block.id }, "Schedule block created");

    return block;
  }
}

export class UpdateBlockUseCase {
  constructor(
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    blockId: string,
    input: {
      startDateTime?: Date | string;
      endDateTime?: Date | string;
      reason?: string;
    },
  ): Promise<ScheduleBlock> {
    this.logger.info({ blockId }, "Updating schedule block");

    const block = await this.blockRepo.findById(blockId);
    if (!block) {
      throw new NotFoundError(`Block with ID ${blockId} not found`);
    }

    const startDate = input.startDateTime
      ? new Date(input.startDateTime)
      : block.startDateTime;
    const endDate = input.endDateTime
      ? new Date(input.endDateTime)
      : block.endDateTime;

    const updatedBlock = ScheduleBlock.create({
      providerId: block.providerId,
      startDateTime: startDate,
      endDateTime: endDate,
      reason: input.reason ?? block.reason,
    });

    await this.blockRepo.save(updatedBlock);

    this.logger.info({ blockId }, "Schedule block updated");

    return updatedBlock;
  }
}

export class DeleteBlockUseCase {
  constructor(
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly logger: Logger,
  ) {}

  async execute(blockId: string): Promise<void> {
    this.logger.info({ blockId }, "Deleting schedule block");

    const block = await this.blockRepo.findById(blockId);
    if (!block) {
      throw new NotFoundError(`Block with ID ${blockId} not found`);
    }

    await this.blockRepo.delete(blockId);

    this.logger.info({ blockId }, "Schedule block deleted");
  }
}

export class GetBlocksForProviderUseCase {
  constructor(private readonly blockRepo: IScheduleBlockRepository) {}

  async execute(providerId: string): Promise<ScheduleBlock[]> {
    return this.blockRepo.findByProviderId(providerId);
  }
}

export class ClearRangeUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<{ schedulesDeleted: number; blocksDeleted: number }> {
    this.logger.info(
      { providerId, startDate, endDate },
      "Clearing schedules and blocks in date range",
    );

    const schedules = await this.scheduleRepo.findByProviderId(providerId);
    let schedulesDeleted = 0;

    for (const schedule of schedules) {
      const workingHours = schedule.getWorkingHoursForDate(startDate);
      if (workingHours) {
        if (startDate <= workingHours.end && endDate >= workingHours.start) {
          await this.scheduleRepo.delete(schedule.id);
          schedulesDeleted++;
        }
      }
    }

    const blocks = await this.blockRepo.findByProviderAndDateRange(
      providerId,
      startDate,
      endDate,
    );
    const blocksDeleted = blocks.length;

    for (const block of blocks) {
      await this.blockRepo.delete(block.id);
    }

    this.logger.info(
      { schedulesDeleted, blocksDeleted },
      "Cleared schedules and blocks",
    );

    return { schedulesDeleted, blocksDeleted };
  }
}
