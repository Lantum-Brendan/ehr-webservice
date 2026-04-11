import { Appointment } from "../domain/appointmentEntity.js";

export function toAppointmentDto(appointment: Appointment) {
  return {
    id: appointment.id,
    patientId: appointment.patientId,
    providerId: appointment.providerId,
    appointmentTypeId: appointment.appointmentTypeId,
    durationMinutes: appointment.durationMinutes,
    locationId: appointment.locationId,
    scheduledStart: appointment.scheduledStart.toISOString(),
    scheduledEnd: appointment.scheduledEnd.toISOString(),
    status: appointment.status,
    reason: appointment.reason,
    notes: appointment.notes,
    createdAt: appointment.createdAt.toISOString(),
    updatedAt: appointment.updatedAt.toISOString(),
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancelledBy: appointment.cancelledBy,
    cancelledReason: appointment.cancelledReason,
  };
}

export function toAppointmentListItemDto(appointment: Appointment) {
  return {
    id: appointment.id,
    providerId: appointment.providerId,
    appointmentTypeId: appointment.appointmentTypeId,
    durationMinutes: appointment.durationMinutes,
    scheduledStart: appointment.scheduledStart.toISOString(),
    scheduledEnd: appointment.scheduledEnd.toISOString(),
    status: appointment.status,
    isCancellable: appointment.isCancellable,
  };
}

export function toAppointmentCancellationDto(appointment: Appointment) {
  return {
    id: appointment.id,
    status: appointment.status,
    cancelledAt: appointment.cancelledAt?.toISOString() ?? null,
    cancelledBy: appointment.cancelledBy,
    cancelledReason: appointment.cancelledReason,
  };
}
