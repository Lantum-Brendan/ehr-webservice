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

export class CreateScheduleUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateScheduleInput): Promise<ProviderSchedule> {
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
  ): Promise<ProviderSchedule> {
    this.logger.info({ scheduleId }, "Updating provider schedule");

    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID ${scheduleId} not found`);
    }

    const updatedSchedule = ProviderSchedule.create({
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

  async execute(scheduleId: string): Promise<void> {
    this.logger.info({ scheduleId }, "Deleting provider schedule");

    const schedule = await this.scheduleRepo.findById(scheduleId);
    if (!schedule) {
      throw new NotFoundError(`Schedule with ID ${scheduleId} not found`);
    }

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
