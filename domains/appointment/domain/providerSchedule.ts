import { v4 as uuidv4 } from "uuid";

const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

function parseTime(time: string, label: "Start" | "End") {
  if (!TIME_PATTERN.test(time)) {
    throw new Error(`${label} time must be in HH:mm format (00:00-23:59)`);
  }

  const [hour, minute] = time.split(":").map((part) => parseInt(part, 10));

  return { hour, minute };
}

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
    id?: string;
    providerId: string;
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    isActive?: boolean;
  }): ProviderSchedule {
    if (props.dayOfWeek < 0 || props.dayOfWeek > 6) {
      throw new Error("Day of week must be 0-6 (Sunday-Saturday)");
    }

    const { hour: startHour, minute: startMinute } = parseTime(
      props.startTime,
      "Start",
    );
    const { hour: endHour, minute: endMinute } = parseTime(
      props.endTime,
      "End",
    );

    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    if (endMinutes <= startMinutes) {
      throw new Error("End time must be after start time");
    }

    return new ProviderSchedule(
      props.id ?? uuidv4(),
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
    const { hour, minute } = parseTime(this.startTime, "Start");
    return hour * 60 + minute;
  }

  getEndMinutes(): number {
    const { hour, minute } = parseTime(this.endTime, "End");
    return hour * 60 + minute;
  }

  isWorkingDay(date: Date): boolean {
    return date.getDay() === this.dayOfWeek && this.isActive;
  }

  getWorkingHoursForDate(date: Date): { start: Date; end: Date } | null {
    if (!this.isWorkingDay(date)) {
      return null;
    }

    const start = new Date(date);
    const { hour: startHour, minute: startMinute } = parseTime(
      this.startTime,
      "Start",
    );
    start.setHours(startHour, startMinute, 0, 0);

    const end = new Date(date);
    const { hour: endHour, minute: endMinute } = parseTime(this.endTime, "End");
    end.setHours(endHour, endMinute, 0, 0);

    return { start, end };
  }

  coversInterval(start: Date, end: Date): boolean {
    const workingHours = this.getWorkingHoursForDate(start);

    if (!workingHours) {
      return false;
    }

    return start >= workingHours.start && end <= workingHours.end;
  }
}
