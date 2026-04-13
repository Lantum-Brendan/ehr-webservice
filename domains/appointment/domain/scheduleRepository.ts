import { ProviderSchedule } from "./providerSchedule.js";
import { ScheduleBlock } from "./scheduleBlock.js";

export interface IProviderScheduleRepository {
  findById(id: string): Promise<ProviderSchedule | null>;
  findByProviderId(providerId: string): Promise<ProviderSchedule[]>;
  findByProviderAndDay(
    providerId: string,
    dayOfWeek: number,
  ): Promise<ProviderSchedule[]>;
  save(schedule: ProviderSchedule): Promise<void>;
  delete(id: string): Promise<void>;
}

export interface IScheduleBlockRepository {
  findById(id: string): Promise<ScheduleBlock | null>;
  findByProviderId(providerId: string): Promise<ScheduleBlock[]>;
  findByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<ScheduleBlock[]>;
  save(block: ScheduleBlock): Promise<void>;
  delete(id: string): Promise<void>;
  deleteByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<void>;
}
