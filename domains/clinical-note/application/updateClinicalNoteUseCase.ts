import { ClinicalNote } from "../domain/clinicalNoteEntity.js";
import { type IClinicalNoteRepository } from "../domain/clinicalNoteRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ForbiddenError } from "@core/errors/appError.js";

interface UpdateClinicalNoteInput {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export class UpdateClinicalNoteUseCase {
  constructor(
    private readonly noteRepo: IClinicalNoteRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(
    noteId: string,
    authorId: string,
    input: UpdateClinicalNoteInput,
  ): Promise<ClinicalNote> {
    this.logger.info({ noteId }, "Updating clinical note");

    const note = await this.noteRepo.findById(noteId);
    if (!note) {
      throw new NotFoundError(`Clinical note with ID ${noteId} not found`);
    }

    if (note.authorId !== authorId) {
      throw new ForbiddenError("Only the author can update this clinical note");
    }

    if (note.isSigned()) {
      throw new ForbiddenError("Cannot update a signed clinical note");
    }

    note.updateContent(input);
    await this.noteRepo.save(note);

    await this.eventBus.publish({
      type: "ClinicalNoteUpdated",
      aggregateId: note.id,
      aggregateType: "ClinicalNote",
      occurredOn: new Date(),
      payload: {
        noteId: note.id,
        encounterId: note.encounterId,
        patientId: note.patientId,
        authorId: note.authorId,
      },
    });

    this.logger.info({ noteId }, "Clinical note updated");

    return note;
  }
}
