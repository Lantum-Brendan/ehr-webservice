import { prisma } from "@infrastructure/database/prisma.client.js";
import { ClinicalNote } from "../domain/clinicalNoteEntity.js";
import { type IClinicalNoteRepository } from "../domain/clinicalNoteRepository.js";

export class PrismaClinicalNoteRepository implements IClinicalNoteRepository {
  async findById(id: string): Promise<ClinicalNote | null> {
    const record = await prisma.clinicalNote.findUnique({ where: { id } });
    if (!record) return null;
    return this.mapToEntity(record);
  }

  async findByEncounterId(encounterId: string): Promise<ClinicalNote[]> {
    const records = await prisma.clinicalNote.findMany({
      where: { encounterId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(this.mapToEntity);
  }

  async findByPatientId(patientId: string): Promise<ClinicalNote[]> {
    const records = await prisma.clinicalNote.findMany({
      where: { patientId },
      orderBy: { createdAt: "desc" },
    });
    return records.map(this.mapToEntity);
  }

  async findSignedByPatientId(patientId: string): Promise<ClinicalNote[]> {
    const records = await prisma.clinicalNote.findMany({
      where: { patientId, status: "SIGNED" },
      orderBy: { signedAt: "desc" },
    });
    return records.map(this.mapToEntity);
  }

  async save(note: ClinicalNote): Promise<void> {
    const data = {
      id: note.id,
      encounterId: note.encounterId,
      patientId: note.patientId,
      authorId: note.authorId,
      subjective: note.subjective,
      objective: note.objective,
      assessment: note.assessment,
      plan: note.plan,
      status: note.status,
      signedAt: note.signedAt,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };

    await prisma.clinicalNote.upsert({
      where: { id: note.id },
      update: data,
      create: data,
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.clinicalNote.delete({ where: { id } });
  }

  private mapToEntity(record: {
    id: string;
    encounterId: string;
    patientId: string;
    authorId: string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    status: string;
    signedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): ClinicalNote {
    return ClinicalNote.rehydrate({
      id: record.id,
      encounterId: record.encounterId,
      patientId: record.patientId,
      authorId: record.authorId,
      subjective: record.subjective,
      objective: record.objective,
      assessment: record.assessment,
      plan: record.plan,
      status: record.status,
      signedAt: record.signedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }
}
