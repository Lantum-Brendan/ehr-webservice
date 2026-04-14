import { Patient } from "./patientEntity.js";

export interface PatientSearchParams {
  id?: string;
  mrn?: string;
  firstName?: string;
  lastName?: string;
}

export interface IPatientRepository {
  findById(id: string): Promise<Patient | null>;
  findByMrn(mrn: string): Promise<Patient | null>;
  findAll(): Promise<Patient[]>;
  search(params: PatientSearchParams): Promise<Patient[]>;
  save(patient: Patient): Promise<void>;
  delete(id: string): Promise<void>;
}
