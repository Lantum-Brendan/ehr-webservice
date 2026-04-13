import { ProviderSchedule } from "./providerSchedule.js";
import { ScheduleBlock } from "./scheduleBlock.js";

export interface IProviderScheduleRepository {
  findByProviderId(providerId: string): Promise<ProviderSchedule[]>;
  findByProviderAndDay(
    providerId: string,
    dayOfWeek: number,
  ): Promise<ProviderSchedule[]>;
}

export interface IScheduleBlockRepository {
  findByProviderId(providerId: string): Promise<ScheduleBlock[]>;
  findByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ScheduleBlock[]>;
}
