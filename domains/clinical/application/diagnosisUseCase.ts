import { Diagnosis } from "../domain/diagnosisEntity.js";
import { IClinicalRepository } from "../domain/clinicalRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.ts";

interface CreateDiagnosisInput {
  patientId: string;
  encounterId?: string;
  code: string;
  description: string;
  onsetDate?: Date;
  recordedBy: string;
}

export class CreateDiagnosisUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateDiagnosisInput): Promise<Diagnosis> {
    this.logger.info(
      { patientId: input.patientId, code: input.code },
      "Creating diagnosis",
    );

    const diagnosis = Diagnosis.create(input);
    await this.clinicalRepo.saveDiagnosis(diagnosis);

    this.logger.info({ diagnosisId: diagnosis.id }, "Diagnosis created");
    return diagnosis;
  }
}

export class UpdateDiagnosisUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    diagnosisId: string,
    action: "RESOLVE" | "DEACTIVATE",
  ): Promise<Diagnosis> {
    const diagnosis = await this.clinicalRepo.findDiagnosisById(diagnosisId);
    if (!diagnosis) {
      throw new NotFoundError(`Diagnosis ${diagnosisId} not found`);
    }

    if (action === "RESOLVE") {
      diagnosis.resolve();
    } else if (action === "DEACTIVATE") {
      diagnosis.deactivate();
    }

    await this.clinicalRepo.saveDiagnosis(diagnosis);
    this.logger.info(
      { diagnosisId: diagnosis.id, status: diagnosis.status },
      "Diagnosis updated",
    );
    return diagnosis;
  }
}

export class GetDiagnosesForPatientUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(patientId: string): Promise<Diagnosis[]> {
    const diagnoses =
      await this.clinicalRepo.findDiagnosesByPatientId(patientId);
    this.logger.info({ count: diagnoses.length }, "Diagnoses fetched");
    return diagnoses;
  }
}
