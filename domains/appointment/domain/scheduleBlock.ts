import { v4 as uuidv4 } from "uuid";

export class ScheduleBlock {
  public readonly id: string;
  public readonly providerId: string;
  public readonly startDateTime: Date;
  public readonly endDateTime: Date;
  public readonly reason: string;

  private constructor(
    id: string,
    providerId: string,
    startDateTime: Date,
    endDateTime: Date,
    reason: string,
  ) {
    this.id = id;
    this.providerId = providerId;
    this.startDateTime = startDateTime;
    this.endDateTime = endDateTime;
    this.reason = reason;
  }

  static create(props: {
    providerId: string;
    startDateTime: Date | string;
    endDateTime: Date | string;
    reason: string;
  }): ScheduleBlock {
    const startDateTime =
      typeof props.startDateTime === "string"
        ? new Date(props.startDateTime)
        : props.startDateTime;
    const endDateTime =
      typeof props.endDateTime === "string"
        ? new Date(props.endDateTime)
        : props.endDateTime;

    if (isNaN(startDateTime.getTime())) {
      throw new Error("Start date time must be valid");
    }

    if (isNaN(endDateTime.getTime())) {
      throw new Error("End date time must be valid");
    }

    if (endDateTime <= startDateTime) {
      throw new Error("End time must be after start time");
    }

    if (!props.reason.trim()) {
      throw new Error("Reason is required");
    }

    return new ScheduleBlock(
      uuidv4(),
      props.providerId,
      startDateTime,
      endDateTime,
      props.reason.trim(),
    );
  }

  static rehydrate(props: {
    id: string;
    providerId: string;
    startDateTime: Date | string;
    endDateTime: Date | string;
    reason: string;
  }): ScheduleBlock {
    const startDateTime =
      typeof props.startDateTime === "string"
        ? new Date(props.startDateTime)
        : props.startDateTime;
    const endDateTime =
      typeof props.endDateTime === "string"
        ? new Date(props.endDateTime)
        : props.endDateTime;

    return new ScheduleBlock(
      props.id,
      props.providerId,
      startDateTime,
      endDateTime,
      props.reason,
    );
  }

  blocksTime(time: Date): boolean {
    return time >= this.startDateTime && time < this.endDateTime;
  }

  blocksInterval(start: Date, end: Date): boolean {
    return this.startDateTime < end && this.endDateTime > start;
  }

  overlapsWith(start: Date, end: Date): boolean {
    return this.startDateTime < end && this.endDateTime > start;
  }
}
