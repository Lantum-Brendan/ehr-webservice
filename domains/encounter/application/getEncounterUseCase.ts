import { type IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { NotFoundError } from "@core/errors/appError.js";
import { type Logger } from "@shared/logger/index.js";
import { Encounter } from "../domain/encounterEntity.js";
import { type IEncounterRepository } from "../domain/encounterRepository.js";

export class GetEncounterUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly logger: Logger,
  ) {}

  async execute(encounterId: string): Promise<Encounter> {
    this.logger.info({ encounterId }, "Fetching encounter");

    const encounter = await this.encounterRepo.findById(encounterId);
    if (!encounter) {
      throw new NotFoundError(`Encounter ${encounterId} not found`);
    }

    return encounter;
  }
}

export class GetEncountersForPatientUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly patientRepo: IPatientRepository,
  ) {}

  async execute(patientId: string): Promise<Encounter[]> {
    const patient = await this.patientRepo.findById(patientId);
    if (!patient) {
      throw new NotFoundError(`Patient ${patientId} not found`);
    }

    return this.encounterRepo.findByPatientId(patientId);
  }
}

export class GetEncountersForProviderUseCase {
  constructor(private readonly encounterRepo: IEncounterRepository) {}

  async execute(providerId: string): Promise<Encounter[]> {
    return this.encounterRepo.findByProviderId(providerId);
  }
}
