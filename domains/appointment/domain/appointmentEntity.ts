import { v4 as uuidv4 } from "uuid";
import {
  AppointmentStatus,
  isCancellable,
  isActive,
} from "./appointmentStatus.js";

function normalizeDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function resolveNow(now?: Date): Date {
  return now ?? new Date();
}

export class Appointment {
  public readonly id: string;
  public readonly patientId: string;
  public readonly providerId: string;

  private _appointmentTypeId: string;
  private _durationMinutes: number;
  private _locationId: string | null;
  private _scheduledStart: Date;
  private _scheduledEnd: Date;
  private _status: AppointmentStatus;
  private _reason: string | null;
  private _notes: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;
  private _cancelledAt: Date | null;
  private _cancelledBy: string | null;
  private _cancelledReason: string | null;

  private constructor(
    id: string,
    patientId: string,
    providerId: string,
    appointmentTypeId: string,
    durationMinutes: number,
    locationId: string | null,
    scheduledStart: Date,
    scheduledEnd: Date,
    status: AppointmentStatus,
    reason: string | null,
    notes: string | null,
    createdAt: Date,
    updatedAt: Date,
    cancelledAt: Date | null,
    cancelledBy: string | null,
    cancelledReason: string | null,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.providerId = providerId;
    this._appointmentTypeId = appointmentTypeId;
    this._durationMinutes = durationMinutes;
    this._locationId = locationId;
    this._scheduledStart = scheduledStart;
    this._scheduledEnd = scheduledEnd;
    this._status = status;
    this._reason = reason;
    this._notes = notes;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
    this._cancelledAt = cancelledAt;
    this._cancelledBy = cancelledBy;
    this._cancelledReason = cancelledReason;
  }

  static create(props: {
    patientId: string;
    providerId: string;
    appointmentTypeId: string;
    durationMinutes: number;
    locationId?: string | null;
    scheduledStart: Date | string;
    reason?: string | null;
    now?: Date;
  }): Appointment {
    if (!props.patientId) {
      throw new Error("Patient ID is required");
    }
    if (!props.providerId) {
      throw new Error("Provider ID is required");
    }
    if (!props.appointmentTypeId) {
      throw new Error("Appointment type is required");
    }
    if (props.durationMinutes <= 0) {
      throw new Error("Duration must be positive");
    }

    const scheduledStart = normalizeDate(props.scheduledStart);

    if (isNaN(scheduledStart.getTime())) {
      throw new Error("Scheduled start must be a valid date");
    }

    const now = resolveNow(props.now);

    if (scheduledStart < now) {
      throw new Error("Scheduled start cannot be in the past");
    }

    const scheduledEnd = new Date(
      scheduledStart.getTime() + props.durationMinutes * 60 * 1000,
    );

    return new Appointment(
      uuidv4(),
      props.patientId,
      props.providerId,
      props.appointmentTypeId,
      props.durationMinutes,
      props.locationId ?? null,
      scheduledStart,
      scheduledEnd,
      AppointmentStatus.SCHEDULED,
      props.reason ?? null,
      null,
      now,
      now,
      null,
      null,
      null,
    );
  }

  static rehydrate(props: {
    id: string;
    patientId: string;
    providerId: string;
    appointmentTypeId: string;
    durationMinutes: number;
    locationId?: string | null;
    scheduledStart: Date | string;
    scheduledEnd: Date | string;
    status: string;
    reason?: string | null;
    notes?: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
    cancelledAt?: Date | string | null;
    cancelledBy?: string | null;
    cancelledReason?: string | null;
  }): Appointment {
    const scheduledStart = normalizeDate(props.scheduledStart);
    const scheduledEnd = normalizeDate(props.scheduledEnd);
    const createdAt = normalizeDate(props.createdAt);
    const updatedAt = normalizeDate(props.updatedAt);
    const cancelledAt = props.cancelledAt
      ? normalizeDate(props.cancelledAt)
      : null;

    return new Appointment(
      props.id,
      props.patientId,
      props.providerId,
      props.appointmentTypeId,
      props.durationMinutes,
      props.locationId ?? null,
      scheduledStart,
      scheduledEnd,
      props.status as AppointmentStatus,
      props.reason ?? null,
      props.notes ?? null,
      createdAt,
      updatedAt,
      cancelledAt,
      props.cancelledBy ?? null,
      props.cancelledReason ?? null,
    );
  }

  get locationId(): string | null {
    return this._locationId;
  }

  get appointmentTypeId(): string {
    return this._appointmentTypeId;
  }

  get durationMinutes(): number {
    return this._durationMinutes;
  }

  get scheduledStart(): Date {
    return this._scheduledStart;
  }

  get scheduledEnd(): Date {
    return this._scheduledEnd;
  }

  get status(): AppointmentStatus {
    return this._status;
  }

  get reason(): string | null {
    return this._reason;
  }

  get notes(): string | null {
    return this._notes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  get cancelledAt(): Date | null {
    return this._cancelledAt;
  }

  get cancelledBy(): string | null {
    return this._cancelledBy;
  }

  get cancelledReason(): string | null {
    return this._cancelledReason;
  }

  get isCancellable(): boolean {
    return isCancellable(this._status);
  }

  get isActive(): boolean {
    return isActive(this._status);
  }

  assignLocation(locationId: string): void {
    if (this._locationId) {
      throw new Error("Location already assigned");
    }
    this._locationId = locationId;
    this._updatedAt = new Date();
  }

  updateStatus(newStatus: AppointmentStatus): void {
    this._status = newStatus;
    this._updatedAt = new Date();
  }

  updateDetails(props: {
    appointmentTypeId?: string;
    durationMinutes?: number;
    locationId?: string | null;
    scheduledStart?: Date | string;
    reason?: string | null;
    notes?: string | null;
    now?: Date;
  }): void {
    const now = resolveNow(props.now);

    if (
      props.appointmentTypeId !== undefined &&
      props.appointmentTypeId.trim().length === 0
    ) {
      throw new Error("Appointment type is required");
    }

    const nextDuration = props.durationMinutes ?? this._durationMinutes;
    if (nextDuration <= 0) {
      throw new Error("Duration must be positive");
    }

    if (props.appointmentTypeId !== undefined) {
      this._appointmentTypeId = props.appointmentTypeId;
    }

    if (props.locationId !== undefined) {
      this._locationId = props.locationId;
    }

    if (props.reason !== undefined) {
      this._reason = props.reason ?? null;
    }

    if (props.notes !== undefined) {
      this._notes = props.notes ?? null;
    }

    if (
      props.scheduledStart !== undefined ||
      props.durationMinutes !== undefined
    ) {
      const scheduledStart =
        props.scheduledStart !== undefined
          ? normalizeDate(props.scheduledStart)
          : this._scheduledStart;

      if (isNaN(scheduledStart.getTime())) {
        throw new Error("Scheduled start must be a valid date");
      }

      if (props.scheduledStart !== undefined && scheduledStart < now) {
        throw new Error("Scheduled start cannot be in the past");
      }

      this._scheduledStart = scheduledStart;
      this._durationMinutes = nextDuration;
      this._scheduledEnd = new Date(
        this._scheduledStart.getTime() + this._durationMinutes * 60 * 1000,
      );
    } else if (props.appointmentTypeId !== undefined) {
      this._durationMinutes = nextDuration;
      this._scheduledEnd = new Date(
        this._scheduledStart.getTime() + this._durationMinutes * 60 * 1000,
      );
    }

    this._updatedAt = now;
  }

  checkIn(now?: Date): void {
    if (
      this._status !== AppointmentStatus.SCHEDULED &&
      this._status !== AppointmentStatus.CONFIRMED
    ) {
      throw new Error(
        `Cannot check in appointment with status ${this._status}. Only scheduled or confirmed appointments can be checked in.`,
      );
    }
    const checkInTime = resolveNow(now);
    this._status = AppointmentStatus.CHECKED_IN;
    this._updatedAt = checkInTime;
  }

  cancel(
    cancelledBy: string,
    reason?: string,
    cancelledByPatient: boolean = false,
    now?: Date,
  ): void {
    if (!this.isCancellable) {
      throw new Error(`Cannot cancel appointment with status ${this._status}`);
    }
    if (!cancelledBy) {
      throw new Error("Cancelled by is required");
    }
    const cancelledAt = resolveNow(now);

    this._status = cancelledByPatient
      ? AppointmentStatus.CANCELLED_BY_PATIENT
      : AppointmentStatus.CANCELLED_BY_STAFF;
    this._cancelledAt = cancelledAt;
    this._cancelledBy = cancelledBy;
    this._cancelledReason = reason ?? null;
    this._updatedAt = cancelledAt;
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      providerId: this.providerId,
      appointmentTypeId: this._appointmentTypeId,
      durationMinutes: this._durationMinutes,
      locationId: this._locationId,
      scheduledStart: this._scheduledStart.toISOString(),
      scheduledEnd: this._scheduledEnd.toISOString(),
      status: this._status,
      reason: this._reason,
      notes: this._notes,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
      cancelledAt: this._cancelledAt?.toISOString() ?? null,
      cancelledBy: this._cancelledBy,
      cancelledReason: this._cancelledReason,
    };
  }
}
