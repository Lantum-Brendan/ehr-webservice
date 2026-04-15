import { Diagnosis } from "../domain/diagnosisEntity.js";
import { Allergy } from "../domain/allergyEntity.js";
import { Medication } from "../domain/medicationEntity.js";
import { IClinicalRepository } from "../domain/clinicalRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaClinicalRepository implements IClinicalRepository {
  constructor() {}

  // Diagnosis
  async findDiagnosisById(id: string): Promise<Diagnosis | null> {
    const record = await prisma.diagnosis.findUnique({ where: { id } });
    if (!record) return null;
    return Diagnosis.rehydrate(record);
  }

  async findDiagnosesByPatientId(patientId: string): Promise<Diagnosis[]> {
    const records = await prisma.diagnosis.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    });
    return records.map((r) => Diagnosis.rehydrate(r));
  }

  async saveDiagnosis(diagnosis: Diagnosis): Promise<void> {
    await prisma.diagnosis.upsert({
      where: { id: diagnosis.id },
      update: {
        status: diagnosis.status,
        onsetDate: diagnosis.onsetDate,
        resolvedDate: diagnosis.resolvedDate,
      },
      create: {
        id: diagnosis.id,
        patientId: diagnosis.patientId,
        encounterId: diagnosis.encounterId,
        code: diagnosis.code,
        description: diagnosis.description,
        status: diagnosis.status,
        onsetDate: diagnosis.onsetDate,
        resolvedDate: diagnosis.resolvedDate,
        recordedBy: diagnosis.recordedBy,
        recordedAt: diagnosis.recordedAt,
      },
    });
  }

  async deleteDiagnosis(id: string): Promise<void> {
    await prisma.diagnosis.delete({ where: { id } });
  }

  // Allergy
  async findAllergyById(id: string): Promise<Allergy | null> {
    const record = await prisma.allergy.findUnique({ where: { id } });
    if (!record) return null;
    return Allergy.rehydrate(record);
  }

  async findAllergiesByPatientId(patientId: string): Promise<Allergy[]> {
    const records = await prisma.allergy.findMany({
      where: { patientId },
      orderBy: { recordedAt: "desc" },
    });
    return records.map((r) => Allergy.rehydrate(r));
  }

  async saveAllergy(allergy: Allergy): Promise<void> {
    await prisma.allergy.upsert({
      where: { id: allergy.id },
      update: { status: allergy.status },
      create: {
        id: allergy.id,
        patientId: allergy.patientId,
        allergen: allergy.allergen,
        type: allergy.type,
        severity: allergy.severity,
        reaction: allergy.reaction,
        status: allergy.status,
        recordedBy: allergy.recordedBy,
        recordedAt: allergy.recordedAt,
      },
    });
  }

  async deleteAllergy(id: string): Promise<void> {
    await prisma.allergy.delete({ where: { id } });
  }

  // Medication
  async findMedicationById(id: string): Promise<Medication | null> {
    const record = await prisma.medication.findUnique({ where: { id } });
    if (!record) return null;
    return Medication.rehydrate(record);
  }

  async findMedicationsByPatientId(patientId: string): Promise<Medication[]> {
    const records = await prisma.medication.findMany({
      where: { patientId },
      orderBy: { prescribedAt: "desc" },
    });
    return records.map((r) => Medication.rehydrate(r));
  }

  async saveMedication(medication: Medication): Promise<void> {
    await prisma.medication.upsert({
      where: { id: medication.id },
      update: {
        status: medication.status,
        endDate: medication.endDate,
      },
      create: {
        id: medication.id,
        patientId: medication.patientId,
        encounterId: medication.encounterId,
        name: medication.name,
        dosage: medication.dosage,
        frequency: medication.frequency,
        route: medication.route,
        status: medication.status,
        startDate: medication.startDate,
        endDate: medication.endDate,
        prescribedBy: medication.prescribedBy,
        prescribedAt: medication.prescribedAt,
      },
    });
  }

  async deleteMedication(id: string): Promise<void> {
    await prisma.medication.delete({ where: { id } });
  }
}
