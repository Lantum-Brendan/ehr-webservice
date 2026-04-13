import { Encounter } from "./encounterEntity.js";

export interface IEncounterRepository {
  findById(id: string): Promise<Encounter | null>;
  findByPatientId(patientId: string): Promise<Encounter[]>;
  findByProviderId(providerId: string): Promise<Encounter[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Encounter[]>;
  findByAppointmentId(appointmentId: string): Promise<Encounter | null>;
  save(encounter: Encounter): Promise<void>;
  delete(id: string): Promise<void>;
}
