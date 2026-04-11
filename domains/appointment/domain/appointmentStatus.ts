export enum AppointmentStatus {
  SCHEDULED = "SCHEDULED",
  CONFIRMED = "CONFIRMED",
  CHECKED_IN = "CHECKED_IN",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED_BY_PATIENT = "CANCELLED_BY_PATIENT",
  CANCELLED_BY_STAFF = "CANCELLED_BY_STAFF",
  NO_SHOW = "NO_SHOW",
}

export const CANCELLABLE_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
] as const;

export const ACTIVE_STATUSES = [
  AppointmentStatus.SCHEDULED,
  AppointmentStatus.CONFIRMED,
  AppointmentStatus.CHECKED_IN,
  AppointmentStatus.IN_PROGRESS,
] as const;

export function isCancellable(status: AppointmentStatus): boolean {
  return CANCELLABLE_STATUSES.includes(
    status as (typeof CANCELLABLE_STATUSES)[number],
  );
}

export function isActive(status: AppointmentStatus): boolean {
  return ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]);
}
