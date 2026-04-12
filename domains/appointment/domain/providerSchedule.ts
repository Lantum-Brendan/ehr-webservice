import { v4 as uuidv4 } from "uuid";

export class ProviderSchedule {
  public readonly id: string;
  public readonly providerId: string;
  public readonly dayOfWeek: number;
  public readonly startTime: string;
  public readonly endTime: string;
  public readonly isActive: boolean;

  private constructor(
    id: string,
    providerId: string,
    dayOfWeek: number,
    startTime: string,
    endTime: string,
    isActive: boolean,
  ) {
    this.id = id;
    this.providerId = providerId;
    this.dayOfWeek = dayOfWeek;
    this.startTime = startTime;
    this.endTime = endTime;
    this.isActive = isActive;
  }

  static create(props: {
    providerId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }): ProviderSchedule {
    if (props.dayOfWeek < 0 || props.dayOfWeek > 6) {
      throw new Error("Day of week must be 0-6 (Sunday-Saturday)");
    }

    const startParts = props.startTime.split(":");
    const startHour = parseInt(startParts[0], 10);
    const startMinute = parseInt(startParts[1], 10);
    if (
      startHour < 0 ||
      startHour > 23 ||
      startMinute < 0 ||
      startMinute > 59
    ) {
      throw new Error("Start time must be in HH:mm format (00:00-23:59)");
    }

    const endParts = props.endTime.split(":");
    const endHour = parseInt(endParts[0], 10);
    const endMinute = parseInt(endParts[1], 10);
    if (endHour < 0 || endHour > 23 || endMinute < 0 || endMinute > 59) {
      throw new Error("End time must be in HH:mm format (00:00-23:59)");
    }

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (endMinutes <= startMinutes) {
      throw new Error("End time must be after start time");
    }

    return new ProviderSchedule(
      uuidv4(),
      props.providerId,
      props.dayOfWeek,
      props.startTime,
      props.endTime,
      props.isActive ?? true,
    );
  }

  static rehydrate(props: {
    id: string;
    providerId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive: boolean;
  }): ProviderSchedule {
    return new ProviderSchedule(
      props.id,
      props.providerId,
      props.dayOfWeek,
      props.startTime,
      props.endTime,
      props.isActive,
    );
  }

  getStartMinutes(): number {
    const parts = this.startTime.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  getEndMinutes(): number {
    const parts = this.endTime.split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  }

  isWorkingDay(date: Date): boolean {
    return date.getDay() === this.dayOfWeek && this.isActive;
  }

  getWorkingHoursForDate(date: Date): { start: Date; end: Date } | null {
    if (!this.isWorkingDay(date)) {
      return null;
    }

    const start = new Date(date);
    const [startHour, startMinute] = this.startTime.split(":");
    start.setHours(parseInt(startHour, 10), parseInt(startMinute, 10), 0, 0);

    const end = new Date(date);
    const [endHour, endMinute] = this.endTime.split(":");
    end.setHours(parseInt(endHour, 10), parseInt(endMinute, 10), 0, 0);

    return { start, end };
  }
}
