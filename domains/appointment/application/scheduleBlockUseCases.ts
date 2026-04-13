import { ScheduleBlock } from "../domain/scheduleBlock.js";
import {
  type IScheduleBlockRepository,
  type IProviderScheduleRepository,
} from "../domain/scheduleRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ForbiddenError } from "@core/errors/appError.js";

interface CreateBlockInput {
  providerId: string;
  startDateTime: Date | string;
  endDateTime: Date | string;
  reason: string;
}

interface AuthorizeAccessInput {
  targetProviderId: string;
  userId: string;
  userRoles: string[];
}

function authorizeAccess(input: AuthorizeAccessInput): void {
  const isAdmin = input.userRoles.includes("admin");
  const isReception = input.userRoles.includes("reception");
  const isOwnData = input.targetProviderId === input.userId;

  if (!isAdmin && !isReception && !isOwnData) {
    throw new ForbiddenError("You can only manage your own schedule");
  }
}

export class CreateBlockUseCase {
  constructor(
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    input: CreateBlockInput,
    userId: string,
    userRoles: string[],
  ): Promise<{ block: ScheduleBlock; warnings: string[] }> {
    authorizeAccess({
      targetProviderId: input.providerId,
      userId,
      userRoles,
    });

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
    const warnings: string[] = [];

    for (const schedule of existingSchedules) {
      const scheduleStart = schedule.getWorkingHoursForDate(startDate);
      if (scheduleStart) {
        if (startDate < scheduleStart.end && endDate > scheduleStart.start) {
          warnings.push(
            `Blocks schedule on day ${schedule.dayOfWeek} (${schedule.startTime}-${schedule.endTime})`,
          );
        }
      }
    }

    if (warnings.length > 0) {
      this.logger.warn({ warnings }, "Block overlaps with schedules");
    }

    const block = ScheduleBlock.create({
      providerId: input.providerId,
      startDateTime: startDate,
      endDateTime: endDate,
      reason: input.reason,
    });

    await this.blockRepo.save(block);

    this.logger.info({ blockId: block.id }, "Schedule block created");

    return { block, warnings };
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
    userId: string,
    userRoles: string[],
  ): Promise<ScheduleBlock> {
    this.logger.info({ blockId }, "Updating schedule block");

    const block = await this.blockRepo.findById(blockId);
    if (!block) {
      throw new NotFoundError(`Block with ID ${blockId} not found`);
    }

    authorizeAccess({
      targetProviderId: block.providerId,
      userId,
      userRoles,
    });

    const startDate = input.startDateTime
      ? new Date(input.startDateTime)
      : block.startDateTime;
    const endDate = input.endDateTime
      ? new Date(input.endDateTime)
      : block.endDateTime;

    const updatedBlock = ScheduleBlock.create({
      id: block.id,
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

  async execute(
    blockId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    this.logger.info({ blockId }, "Deleting schedule block");

    const block = await this.blockRepo.findById(blockId);
    if (!block) {
      throw new NotFoundError(`Block with ID ${blockId} not found`);
    }

    authorizeAccess({
      targetProviderId: block.providerId,
      userId,
      userRoles,
    });

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
    userId: string,
    userRoles: string[],
  ): Promise<{ schedulesDeleted: number; blocksDeleted: number }> {
    const isAdmin = userRoles.includes("admin");
    const isReception = userRoles.includes("reception");
    const isOwnData = providerId === userId;

    if (!isAdmin && !isReception && !isOwnData) {
      throw new ForbiddenError("You can only manage your own schedule");
    }

    this.logger.info(
      { providerId, startDate, endDate },
      "Clearing schedules and blocks in date range",
    );

    const schedules = await this.scheduleRepo.findByProviderId(providerId);
    let schedulesDeleted = 0;

    const start = new Date(startDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const uniqueDays = new Set<number>();
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      uniqueDays.add(d.getDay());
    }

    let schedulesDeleted = 0;
    for (const dayOfWeek of uniqueDays) {
      const count = await this.scheduleRepo.deleteByProviderAndDayOfWeek(
        providerId,
        dayOfWeek,
      );
      schedulesDeleted += count;
    }

    const blocksDeleted = await this.blockRepo.deleteByProviderAndDateRange(
      providerId,
      start,
      end,
    );

    this.logger.info(
      { schedulesDeleted, blocksDeleted },
      "Cleared schedules and blocks",
    );

    return { schedulesDeleted, blocksDeleted };
  }
}
