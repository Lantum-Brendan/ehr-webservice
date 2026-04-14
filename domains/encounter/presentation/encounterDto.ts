import { Encounter } from "../domain/encounterEntity.js";

export function toEncounterDto(encounter: Encounter) {
  return {
    id: encounter.id,
    patientId: encounter.patientId,
    appointmentId: encounter.appointmentId,
    providerId: encounter.providerId,
    encounterType: encounter.encounterTypeValue,
    startTime: encounter.startTimeValue.toISOString(),
    endTime: encounter.endTimeValue?.toISOString() ?? null,
    status: encounter.statusValue,
    durationMinutes: encounter.durationMinutes,
  };
}
