import { Appointment } from "./appointmentEntity.js";

export interface IAppointmentRepository {
  findById(id: string): Promise<Appointment | null>;
  findByPatientId(patientId: string): Promise<Appointment[]>;
  findByProviderId(providerId: string): Promise<Appointment[]>;
  findByDateRange(startDate: Date, endDate: Date): Promise<Appointment[]>;
  findByProviderAndDateRange(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]>;
  findOverlappingForProvider(
    providerId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Appointment[]>;
  save(appointment: Appointment): Promise<void>;
  delete(id: string): Promise<void>;
}
