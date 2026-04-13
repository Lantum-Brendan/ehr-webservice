import { ClinicalNote } from "./clinicalNoteEntity.js";

export interface IClinicalNoteRepository {
  findById(id: string): Promise<ClinicalNote | null>;
  findByEncounterId(encounterId: string): Promise<ClinicalNote[]>;
  findByPatientId(patientId: string): Promise<ClinicalNote[]>;
  findSignedByPatientId(patientId: string): Promise<ClinicalNote[]>;
  save(note: ClinicalNote): Promise<void>;
  delete(id: string): Promise<void>;
}
