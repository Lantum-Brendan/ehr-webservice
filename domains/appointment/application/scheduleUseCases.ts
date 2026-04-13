import { ProviderSchedule } from "../domain/providerSchedule.js";
import { type IProviderScheduleRepository } from "../domain/scheduleRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ForbiddenError } from "@core/errors/appError.js";

interface CreateScheduleInput {
  providerId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isActive?: boolean;
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

export class CreateScheduleUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    input: CreateScheduleInput,
    userId: string,
    userRoles: string[],
  ): Promise<ProviderSchedule> {
    authorizeAccess({
      targetProviderId: input.providerId,
      userId,
      userRoles,
    });

    this.logger.info(
      { providerId: input.providerId, dayOfWeek: input.dayOfWeek },
      "Creating provider schedule",
    );

    const schedule = ProviderSchedule.create({
      providerId: input.providerId,
      dayOfWeek: input.dayOfWeek,
      startTime: input.startTime,
      endTime: input.endTime,
      isActive: input.isActive ?? true,
    });

    await this.scheduleRepo.save(schedule);

    this.logger.info({ scheduleId: schedule.id }, "Schedule created");

    return schedule;
  }
}

export class UpdateScheduleUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    scheduleId: string,
    input: {
      startTime?: string;
      endTime?: string;
      isActive?: boolean;
    },
    userId: string,
    userRoles: string[],
  ): Promise<ProviderSchedule> {
    this.logger.info({ scheduleId }, "Updating provider schedule");

    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID ${scheduleId} not found`);
    }

    authorizeAccess({
      targetProviderId: schedule.providerId,
      userId,
      userRoles,
    });

    const updatedSchedule = ProviderSchedule.create({
      id: schedule.id,
      providerId: schedule.providerId,
      dayOfWeek: schedule.dayOfWeek,
      startTime: input.startTime ?? schedule.startTime,
      endTime: input.endTime ?? schedule.endTime,
      isActive: input.isActive ?? schedule.isActive,
    });

    await this.scheduleRepo.save(updatedSchedule);

    this.logger.info({ scheduleId }, "Schedule updated");

    return updatedSchedule;
  }
}

export class DeleteScheduleUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    scheduleId: string,
    userId: string,
    userRoles: string[],
  ): Promise<void> {
    this.logger.info({ scheduleId }, "Deleting provider schedule");

    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID ${scheduleId} not found`);
    }

    authorizeAccess({
      targetProviderId: schedule.providerId,
      userId,
      userRoles,
    });

    await this.scheduleRepo.delete(scheduleId);

    this.logger.info({ scheduleId }, "Schedule deleted");
  }
}

export class GetSchedulesForProviderUseCase {
  constructor(private readonly scheduleRepo: IProviderScheduleRepository) {}

  async execute(providerId: string): Promise<ProviderSchedule[]> {
    return this.scheduleRepo.findByProviderId(providerId);
  }
}
