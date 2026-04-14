import { BadRequestError, ConflictError, NotFoundError } from "@core/errors/appError.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { Encounter } from "../domain/encounterEntity.js";
import { type IEncounterRepository } from "../domain/encounterRepository.js";

function getMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Invalid encounter update";
}

async function getEncounterOrThrow(
  encounterRepo: IEncounterRepository,
  encounterId: string,
): Promise<Encounter> {
  const encounter = await encounterRepo.findById(encounterId);
  if (!encounter) {
    throw new NotFoundError(`Encounter ${encounterId} not found`);
  }

  return encounter;
}

export class StartEncounterUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(
    encounterId: string,
    input: { startTime?: Date | string } = {},
  ): Promise<Encounter> {
    this.logger.info({ encounterId }, "Starting encounter");

    const encounter = await getEncounterOrThrow(this.encounterRepo, encounterId);

    if (encounter.isCompleted() || encounter.isCancelled()) {
      throw new ConflictError(
        `Cannot start encounter with status ${encounter.statusValue}`,
      );
    }

    if (encounter.statusValue === "in-progress") {
      throw new ConflictError("Encounter is already in progress");
    }

    try {
      encounter.updateTimings(
        input.startTime ? new Date(input.startTime) : new Date(),
        null,
      );
      encounter.updateStatus("in-progress");
    } catch (error) {
      throw new BadRequestError(getMessage(error));
    }

    await this.encounterRepo.save(encounter);
    await this.eventBus.publish({
      type: "EncounterStarted",
      aggregateId: encounter.id,
      aggregateType: "Encounter",
      occurredOn: new Date(),
      payload: {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        startTime: encounter.startTimeValue.toISOString(),
        status: encounter.statusValue,
      },
    });

    return encounter;
  }
}

export class CompleteEncounterUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(
    encounterId: string,
    input: { endTime?: Date | string } = {},
  ): Promise<Encounter> {
    this.logger.info({ encounterId }, "Completing encounter");

    const encounter = await getEncounterOrThrow(this.encounterRepo, encounterId);

    if (encounter.isCompleted() || encounter.isCancelled()) {
      throw new ConflictError(
        `Cannot complete encounter with status ${encounter.statusValue}`,
      );
    }

    try {
      encounter.updateTimings(
        encounter.startTimeValue,
        input.endTime ? new Date(input.endTime) : new Date(),
      );
      encounter.updateStatus("completed");
    } catch (error) {
      throw new BadRequestError(getMessage(error));
    }

    await this.encounterRepo.save(encounter);
    await this.eventBus.publish({
      type: "EncounterCompleted",
      aggregateId: encounter.id,
      aggregateType: "Encounter",
      occurredOn: new Date(),
      payload: {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        endTime: encounter.endTimeValue?.toISOString() ?? null,
        status: encounter.statusValue,
      },
    });

    return encounter;
  }
}

export class CancelEncounterUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(encounterId: string): Promise<Encounter> {
    this.logger.info({ encounterId }, "Cancelling encounter");

    const encounter = await getEncounterOrThrow(this.encounterRepo, encounterId);

    if (encounter.isCompleted() || encounter.isCancelled()) {
      throw new ConflictError(
        `Cannot cancel encounter with status ${encounter.statusValue}`,
      );
    }

    encounter.updateStatus("cancelled");
    await this.encounterRepo.save(encounter);

    await this.eventBus.publish({
      type: "EncounterCancelled",
      aggregateId: encounter.id,
      aggregateType: "Encounter",
      occurredOn: new Date(),
      payload: {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        status: encounter.statusValue,
      },
    });

    return encounter;
  }
}

export class DeleteEncounterUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(encounterId: string): Promise<void> {
    this.logger.info({ encounterId }, "Deleting encounter");

    const encounter = await getEncounterOrThrow(this.encounterRepo, encounterId);

    await this.encounterRepo.delete(encounterId);
    await this.eventBus.publish({
      type: "EncounterDeleted",
      aggregateId: encounter.id,
      aggregateType: "Encounter",
      occurredOn: new Date(),
      payload: {
        encounterId: encounter.id,
        patientId: encounter.patientId,
      },
    });
  }
}
