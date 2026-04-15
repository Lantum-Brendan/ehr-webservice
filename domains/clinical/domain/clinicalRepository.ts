import { Diagnosis } from "./diagnosisEntity.js";
import { Allergy } from "./allergyEntity.js";
import { Medication } from "./medicationEntity.js";

export interface IClinicalRepository {
  // Diagnosis operations
  findDiagnosisById(id: string): Promise<Diagnosis | null>;
  findDiagnosesByPatientId(patientId: string): Promise<Diagnosis[]>;
  saveDiagnosis(diagnosis: Diagnosis): Promise<void>;
  deleteDiagnosis(id: string): Promise<void>;

  // Allergy operations
  findAllergyById(id: string): Promise<Allergy | null>;
  findAllergiesByPatientId(patientId: string): Promise<Allergy[]>;
  saveAllergy(allergy: Allergy): Promise<void>;
  deleteAllergy(id: string): Promise<void>;

  // Medication operations
  findMedicationById(id: string): Promise<Medication | null>;
  findMedicationsByPatientId(patientId: string): Promise<Medication[]>;
  saveMedication(medication: Medication): Promise<void>;
  deleteMedication(id: string): Promise<void>;
}
