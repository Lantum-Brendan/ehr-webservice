import { ProviderSchedule } from "../domain/providerSchedule.js";
import {
  type IProviderScheduleRepository,
  type IScheduleBlockRepository,
} from "../domain/scheduleRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ForbiddenError } from "@core/errors/appError.js";

interface CopyWeekInput {
  sourceProviderId: string;
  targetProviderId: string;
  copyActiveOnly?: boolean;
}

export class CopyWeekScheduleUseCase {
  constructor(
    private readonly scheduleRepo: IProviderScheduleRepository,
    private readonly blockRepo: IScheduleBlockRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    input: CopyWeekInput,
    userId: string,
    userRoles: string[],
  ): Promise<{ schedules: ProviderSchedule[]; warnings: string[] }> {
    const isAdmin = userRoles.includes("admin");
    if (!isAdmin) {
      throw new ForbiddenError("Only admins can copy schedules");
    }

    this.logger.info(
      {
        sourceProviderId: input.sourceProviderId,
        targetProviderId: input.targetProviderId,
      },
      "Copying provider schedule",
    );

    const sourceSchedules = await this.scheduleRepo.findByProviderId(
      input.sourceProviderId,
    );

    if (sourceSchedules.length === 0) {
      throw new NotFoundError(
        `No schedules found for source provider ${input.sourceProviderId}`,
      );
    }

    const copyActiveOnly = input.copyActiveOnly ?? true;
    const schedulesToCopy = copyActiveOnly
      ? sourceSchedules.filter((s) => s.isActive)
      : sourceSchedules;

    const targetSchedules: ProviderSchedule[] = [];
    const warnings: string[] = [];

    for (const sourceSchedule of schedulesToCopy) {
      const targetSchedulesOnDay = await this.scheduleRepo.findByProviderAndDay(
        input.targetProviderId,
        sourceSchedule.dayOfWeek,
      );

      for (const target of targetSchedulesOnDay) {
        if (
          target.startTime === sourceSchedule.startTime &&
          target.endTime === sourceSchedule.endTime
        ) {
          warnings.push(
            `Day ${sourceSchedule.dayOfWeek}: ${sourceSchedule.startTime}-${sourceSchedule.endTime} already exists`,
          );
          continue;
        }
      }

      const newSchedule = ProviderSchedule.create({
        providerId: input.targetProviderId,
        dayOfWeek: sourceSchedule.dayOfWeek,
        startTime: sourceSchedule.startTime,
        endTime: sourceSchedule.endTime,
        isActive: sourceSchedule.isActive,
      });

      await this.scheduleRepo.save(newSchedule);
      targetSchedules.push(newSchedule);
    }

    if (warnings.length > 0) {
      this.logger.warn(
        { warnings },
        "Some schedules already existed on target provider",
      );
    }

    this.logger.info(
      { copiedCount: targetSchedules.length, warnings: warnings.length },
      "Schedule copied",
    );

    return { schedules: targetSchedules, warnings };
  }
}
