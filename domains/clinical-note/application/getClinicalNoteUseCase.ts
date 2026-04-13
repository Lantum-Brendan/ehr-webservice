import { ClinicalNote } from "../domain/clinicalNoteEntity.js";
import { type IClinicalNoteRepository } from "../domain/clinicalNoteRepository.js";
import { NotFoundError } from "@core/errors/appError.js";

export class GetClinicalNoteUseCase {
  constructor(private readonly noteRepo: IClinicalNoteRepository) {}

  async execute(noteId: string): Promise<ClinicalNote> {
    const note = await this.noteRepo.findById(noteId);
    if (!note) {
      throw new NotFoundError(`Clinical note with ID ${noteId} not found`);
    }
    return note;
  }
}

export class GetClinicalNotesForEncounterUseCase {
  constructor(private readonly noteRepo: IClinicalNoteRepository) {}

  async execute(encounterId: string): Promise<ClinicalNote[]> {
    return this.noteRepo.findByEncounterId(encounterId);
  }
}

export class GetClinicalNotesForPatientUseCase {
  constructor(private readonly noteRepo: IClinicalNoteRepository) {}

  async execute(patientId: string): Promise<ClinicalNote[]> {
    return this.noteRepo.findByPatientId(patientId);
  }
}

export class GetSignedClinicalNotesForPatientUseCase {
  constructor(private readonly noteRepo: IClinicalNoteRepository) {}

  async execute(patientId: string): Promise<ClinicalNote[]> {
    return this.noteRepo.findSignedByPatientId(patientId);
  }
}
