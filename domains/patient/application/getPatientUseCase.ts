import { Patient } from "../domain/patientEntity.js";
import { IPatientRepository } from "../domain/patientRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.js";

export class GetPatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly logger: Logger,
  ) {}

  async execute(patientId: string): Promise<Patient | null> {
    this.logger.info({ patientId }, "Fetching patient");

    const patient = await this.patientRepo.findById(patientId);

    if (!patient) {
      throw new NotFoundError(`Patient ${patientId} not found`);
    }

    this.logger.info({ patientId: patient.id }, "Patient fetched successfully");
    return patient;
  }
}
