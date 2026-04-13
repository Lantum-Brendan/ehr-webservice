import { ClinicalNote } from "../domain/clinicalNoteEntity.js";
import { type IClinicalNoteRepository } from "../domain/clinicalNoteRepository.js";
import { type IEncounterRepository } from "@domains/encounter/domain/encounterRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.js";

interface CreateClinicalNoteInput {
  encounterId: string;
  patientId: string;
  authorId: string;
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export class CreateClinicalNoteUseCase {
  constructor(
    private readonly noteRepo: IClinicalNoteRepository,
    private readonly encounterRepo: IEncounterRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateClinicalNoteInput): Promise<ClinicalNote> {
    this.logger.info(
      { encounterId: input.encounterId },
      "Creating clinical note",
    );

    const encounter = await this.encounterRepo.findById(input.encounterId);
    if (!encounter) {
      throw new NotFoundError(
        `Encounter with ID ${input.encounterId} not found`,
      );
    }

    if (encounter.patientId !== input.patientId) {
      throw new BadRequestError("Patient ID does not match encounter");
    }

    const note = ClinicalNote.create({
      encounterId: input.encounterId,
      patientId: input.patientId,
      authorId: input.authorId,
      subjective: input.subjective,
      objective: input.objective,
      assessment: input.assessment,
      plan: input.plan,
    });

    await this.noteRepo.save(note);

    await this.eventBus.publish({
      type: "ClinicalNoteCreated",
      aggregateId: note.id,
      aggregateType: "ClinicalNote",
      occurredOn: new Date(),
      payload: {
        noteId: note.id,
        encounterId: note.encounterId,
        patientId: note.patientId,
        authorId: note.authorId,
        status: note.status,
      },
    });

    this.logger.info({ noteId: note.id }, "Clinical note created");

    return note;
  }
}
