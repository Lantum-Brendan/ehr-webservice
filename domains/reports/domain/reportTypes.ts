import { Patient } from "../../patient/domain/patientEntity.js";
import { Diagnosis } from "../../clinical/domain/diagnosisEntity.js";
import { Allergy } from "../../clinical/domain/allergyEntity.js";
import { Medication } from "../../clinical/domain/medicationEntity.js";
import { LabOrder } from "../../lab/domain/labOrderEntity.js";
import { LabResult } from "../../lab/domain/labResultEntity.js";

export interface PatientSummaryReport {
  patient: {
    id: string;
    mrn: string;
    name: string;
    dateOfBirth: string;
  };
  allergies: Array<{
    allergen: string;
    type: string;
    severity: string;
    status: string;
  }>;
  activeDiagnoses: Array<{
    code: string;
    description: string;
    onsetDate: string;
  }>;
  activeMedications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    route: string;
  }>;
  recentLabOrders: Array<{
    id: string;
    testType: string;
    status: string;
    orderedAt: string;
    results: Array<{
      testName: string;
      value: string;
      flag: string;
    }>;
  }>;
  generatedAt: string;
}

export interface LabSummaryReport {
  patient: {
    id: string;
    name: string;
  };
  dateRange: {
    start: string;
    end: string;
  };
  orders: Array<{
    id: string;
    testType: string;
    status: string;
    orderedAt: string;
    completedAt: string | null;
    results: Array<{
      testName: string;
      value: string;
      unit: string;
      flag: string;
      referenceRange: string;
    }>;
  }>;
  abnormalResults: number;
  totalResults: number;
  generatedAt: string;
}

export interface ClinicalSummaryReport {
  patient: {
    id: string;
    name: string;
    dateOfBirth: string;
  };
  visitHistory: Array<{
    date: string;
    type: string;
    provider: string;
    chiefComplaint: string;
  }>;
  diagnoses: {
    active: Array<{ code: string; description: string; onsetDate: string }>;
    resolved: Array<{
      code: string;
      description: string;
      resolvedDate: string;
    }>;
  };
  medications: {
    current: Array<{ name: string; dosage: string; frequency: string }>;
    discontinued: Array<{ name: string; endDate: string }>;
  };
  allergies: Array<{ allergen: string; severity: string; reaction: string }>;
  generatedAt: string;
}
