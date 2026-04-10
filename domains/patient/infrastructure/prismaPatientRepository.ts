import { Patient } from "../domain/patientEntity.js";
import { IPatientRepository } from "../domain/patientRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaPatientRepository implements IPatientRepository {
  constructor() {}

  async findById(id: string): Promise<Patient | null> {
    const record = await prisma.patient.findUnique({
      where: { id },
    });

    if (!record) return null;

    return Patient.rehydrate({
      id: record.id,
      mrn: record.mrn,
      firstName: record.firstName,
      lastName: record.lastName,
      dateOfBirth: record.dateOfBirth,
    });
  }

  async findByMrn(mrn: string): Promise<Patient | null> {
    const record = await prisma.patient.findFirst({
      where: { mrn: mrn.toUpperCase() },
    });

    if (!record) return null;

    return Patient.rehydrate({
      id: record.id,
      mrn: record.mrn,
      firstName: record.firstName,
      lastName: record.lastName,
      dateOfBirth: record.dateOfBirth,
    });
  }

  async findAll(): Promise<Patient[]> {
    const records = await prisma.patient.findMany();
    return records.map((record) =>
      Patient.rehydrate({
        id: record.id,
        mrn: record.mrn,
        firstName: record.firstName,
        lastName: record.lastName,
        dateOfBirth: record.dateOfBirth,
      }),
    );
  }

  async save(patient: Patient): Promise<void> {
    await prisma.patient.upsert({
      where: { id: patient.id },
      update: {
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
        dateOfBirth: patient.dateOfBirthValue,
      },
      create: {
        id: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
        dateOfBirth: patient.dateOfBirthValue,
      },
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.patient.delete({
      where: { id },
    });
  }
}
