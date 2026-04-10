import { v4 as uuidv4 } from "uuid";

export class Encounter {
  // Identity - never changes
  public readonly id: string;
  public readonly patientId: string;

  // Mutable properties
  private encounterType: string;
  private startTime: Date;
  private endTime: Date | null;
  private status: string;

  private constructor(
    id: string,
    patientId: string,
    encounterType: string,
    startTime: Date,
    endTime: Date | null,
    status: string,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.encounterType = encounterType;
    this.startTime = startTime;
    this.endTime = endTime;
    this.status = status;
  }

  /**
   * Factory method - controls creation and validates business rules
   */
  static create(props: {
    patientId: string;
    encounterType: string;
    startTime: Date | string;
    endTime?: Date | string;
    status?: string;
  }): Encounter {
    // Business rules
    if (!props.patientId) {
      throw new Error("Patient ID is required");
    }

    if (!props.encounterType.trim()) {
      throw new Error("Encounter type is required");
    }

    const startTime =
      typeof props.startTime === "string"
        ? new Date(props.startTime)
        : props.startTime;

    if (isNaN(startTime.getTime())) {
      throw new Error("Start time must be a valid date");
    }

    let endTime: Date | null = null;
    if (props.endTime !== undefined && props.endTime !== null) {
      endTime =
        typeof props.endTime === "string"
          ? new Date(props.endTime)
          : props.endTime;

      if (isNaN(endTime.getTime())) {
        throw new Error("End time must be a valid date");
      }

      // Business rule: End time must be after start time
      if (endTime < startTime) {
        throw new Error("End time must be after start time");
      }
    }

    const status = props.status ?? "planned";
    const normalizedType = props.encounterType.trim().toLowerCase();

    // Validate encounter type against known types
    const validTypes = [
      "outpatient",
      "inpatient",
      "emergency",
      "telehealth",
      "virtual",
    ];
    if (!validTypes.includes(normalizedType)) {
      throw new Error(
        `Encounter type must be one of: ${validTypes.join(", ")}`,
      );
    }

    // Validate status
    const validStatuses = [
      "planned",
      "arrived",
      "in-progress",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
    }

    return new Encounter(
      uuidv4(),
      props.patientId,
      normalizedType,
      startTime,
      endTime,
      status,
    );
  }

  /**
   * Reconstitutes an Encounter from database record
   * Skips business validation since entity already exists
   * Preserves the existing ID from the database
   */
  static rehydrate(props: {
    id: string;
    patientId: string;
    encounterType: string;
    startTime: Date | string;
    endTime?: Date | string | null;
    status?: string;
  }): Encounter {
    const startTime =
      typeof props.startTime === "string"
        ? new Date(props.startTime)
        : props.startTime;

    let endTime: Date | null = null;
    if (props.endTime !== undefined && props.endTime !== null) {
      endTime =
        typeof props.endTime === "string"
          ? new Date(props.endTime)
          : props.endTime;
    }

    return new Encounter(
      props.id,
      props.patientId,
      props.encounterType.trim().toLowerCase(),
      startTime,
      endTime,
      props.status ?? "planned",
    );
  }

  // Getters
  get encounterTypeValue(): string {
    return this.encounterType;
  }

  get startTimeValue(): Date {
    return this.startTime;
  }

  get endTimeValue(): Date | null {
    return this.endTime;
  }

  get statusValue(): string {
    return this.status;
  }

  get durationMinutes(): number | null {
    if (!this.endTime) return null;
    const diffMs = this.endTime.getTime() - this.startTime.getTime();
    return Math.round(diffMs / (1000 * 60));
  }

  // Domain behavior methods
  updateStatus(newStatus: string): void {
    const validStatuses = [
      "planned",
      "arrived",
      "in-progress",
      "completed",
      "cancelled",
    ];
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Status must be one of: ${validStatuses.join(", ")}`);
    }

    // Business rule: Cannot change status of completed or cancelled encounters
    if (this.status === "completed" || this.status === "cancelled") {
      throw new Error(`Cannot update status of ${this.status} encounter`);
    }

    this.status = newStatus;
  }

  updateTimings(startTime: Date, endTime: Date | null): void {
    if (isNaN(startTime.getTime())) {
      throw new Error("Start time must be a valid date");
    }

    if (endTime !== null && isNaN(endTime.getTime())) {
      throw new Error("End time must be a valid date or null");
    }

    // Business rule: End time must be after start time
    if (endTime !== null && endTime < startTime) {
      throw new Error("End time must be after start time");
    }

    // Business rule: Cannot modify timings of completed encounters
    if (this.status === "completed") {
      throw new Error("Cannot update timings of completed encounter");
    }

    this.startTime = new Date(startTime);
    this.endTime = endTime ? new Date(endTime) : null;
  }

  isCompleted(): boolean {
    return this.status === "completed";
  }

  isCancelled(): boolean {
    return this.status === "cancelled";
  }

  isActive(): boolean {
    return (
      this.status === "planned" ||
      this.status === "arrived" ||
      this.status === "in-progress"
    );
  }

  // For testing/debugging
  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      encounterType: this.encounterType,
      startTime: this.startTime.toISOString(),
      endTime: this.endTime?.toISOString() ?? null,
      status: this.status,
      durationMinutes: this.durationMinutes,
    };
  }
}
