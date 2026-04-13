import { ClinicalNote } from "../domain/clinicalNoteEntity.js";
import { type IClinicalNoteRepository } from "../domain/clinicalNoteRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ForbiddenError } from "@core/errors/appError.js";

export class SignClinicalNoteUseCase {
  constructor(
    private readonly noteRepo: IClinicalNoteRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(noteId: string, authorId: string): Promise<ClinicalNote> {
    this.logger.info({ noteId }, "Signing clinical note");

    const note = await this.noteRepo.findById(noteId);
    if (!note) {
      throw new NotFoundError(`Clinical note with ID ${noteId} not found`);
    }

    if (note.authorId !== authorId) {
      throw new ForbiddenError("Only the author can sign this clinical note");
    }

    if (note.isSigned()) {
      throw new ForbiddenError("Clinical note is already signed");
    }

    note.sign(authorId);
    await this.noteRepo.save(note);

    await this.eventBus.publish({
      type: "ClinicalNoteSigned",
      aggregateId: note.id,
      aggregateType: "ClinicalNote",
      occurredOn: new Date(),
      payload: {
        noteId: note.id,
        encounterId: note.encounterId,
        patientId: note.patientId,
        authorId: note.authorId,
        signedAt: note.signedAt?.toISOString(),
      },
    });

    this.logger.info({ noteId }, "Clinical note signed");

    return note;
  }
}
