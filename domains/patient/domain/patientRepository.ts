import { Patient } from "./patientEntity.js";

export interface IPatientRepository {
  findById(id: string): Promise<Patient | null>;
  findByMrn(mrn: string): Promise<Patient | null>;
  findAll(): Promise<Patient[]>;
  save(patient: Patient): Promise<void>;
  delete(id: string): Promise<void>;
}
