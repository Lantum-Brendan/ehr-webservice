import { Patient } from "../../domains/patient/domain/patientEntity.js";
import { Diagnosis } from "../../domains/clinical/domain/diagnosisEntity.js";
import {
  Allergy,
  AllergyType,
  AllergySeverity,
} from "../../domains/clinical/domain/allergyEntity.js";
import {
  Medication,
  MedicationRoute,
} from "../../domains/clinical/domain/medicationEntity.js";
import {
  LabOrder,
  LabOrderPriority,
} from "../../domains/lab/domain/labOrderEntity.js";
import { LabResult } from "../../domains/lab/domain/labResultEntity.js";
import {
  Appointment,
  AppointmentStatus,
} from "../../domains/appointment/domain/appointmentEntity.js";

export const Fixtures = {
  patient: {
    adult: () =>
      Patient.create({
        mrn: "MRN001",
        firstName: "Eleanor",
        lastName: "Rigby",
        dateOfBirth: new Date("1970-06-15"),
      }),
    minor: () =>
      Patient.create({
        mrn: "MRN002",
        firstName: "Baby",
        lastName: "Jones",
        dateOfBirth: new Date(Date.now() - 5 * 365.25 * 24 * 60 * 60 * 1000),
      }),
    child: () =>
      Patient.create({
        mrn: "MRN003",
        firstName: "Charlie",
        lastName: "Brown",
        dateOfBirth: new Date("2015-03-20"),
      }),
  },

  prismaPatientRecord: (overrides = {}) => ({
    id: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    mrn: "MRN001",
    firstName: "Eleanor",
    lastName: "Rigby",
    dateOfBirth: new Date("1970-06-15"),
    gender: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  diagnosis: (overrides = {}) => ({
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    code: "E11.9",
    description: "Type 2 diabetes mellitus without complications",
    recordedBy: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    ...overrides,
  }),

  allergy: (overrides = {}) => ({
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    allergen: "Penicillin",
    type: AllergyType.DRUG,
    severity: AllergySeverity.SEVERE,
    recordedBy: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    ...overrides,
  }),

  medication: (overrides = {}) => ({
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily",
    route: MedicationRoute.ORAL,
    startDate: new Date(),
    prescribedBy: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    ...overrides,
  }),

  labOrder: (overrides = {}) => ({
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    clinicianId: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    testType: "CBC",
    priority: LabOrderPriority.ROUTINE,
    ...overrides,
  }),

  labResult: (overrides = {}) => ({
    labOrderId: "c0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    testName: "White Blood Cell Count",
    value: "7.5",
    unit: "10^3/uL",
    referenceRange: "4.5-11.0",
    ...overrides,
  }),

  appointment: (
    patientId: string,
    providerId: string,
    appointmentTypeId: string,
    overrides = {},
  ) => ({
    patientId,
    providerId,
    appointmentTypeId,
    scheduledStart: new Date("2099-06-01T10:00:00.000Z"),
    scheduledEnd: new Date("2099-06-01T10:30:00.000Z"),
    durationMinutes: 30,
    status: AppointmentStatus.SCHEDULED,
    ...overrides,
  }),

  prismaDiagnosis: (overrides = {}) => ({
    id: "d0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    encounterId: null,
    code: "E11.9",
    description: "Type 2 diabetes mellitus without complications",
    status: "ACTIVE",
    onsetDate: new Date("2020-01-01"),
    resolvedDate: null,
    recordedBy: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    recordedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  prismaAllergy: (overrides = {}) => ({
    id: "e0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    allergen: "Penicillin",
    type: "DRUG",
    severity: "SEVERE",
    reaction: "Anaphylaxis",
    status: "ACTIVE",
    recordedBy: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    recordedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),

  prismaMedication: (overrides = {}) => ({
    id: "f0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    patientId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    encounterId: null,
    name: "Metformin",
    dosage: "500mg",
    frequency: "Twice daily",
    route: "ORAL",
    status: "ACTIVE",
    startDate: new Date("2024-01-01"),
    endDate: null,
    prescribedBy: "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    prescribedAt: new Date("2024-01-01"),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }),
};
