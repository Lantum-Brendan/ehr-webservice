import { Medication, MedicationRoute } from "../domain/medicationEntity.js";
import { IClinicalRepository } from "../domain/clinicalRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.ts";

interface CreateMedicationInput {
  patientId: string;
  encounterId?: string;
  name: string;
  dosage: string;
  frequency: string;
  route: string;
  startDate: Date;
  prescribedBy: string;
}

export class CreateMedicationUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateMedicationInput): Promise<Medication> {
    this.logger.info(
      { patientId: input.patientId, name: input.name },
      "Creating medication",
    );

    const medication = Medication.create({
      ...input,
      route: input.route as MedicationRoute,
    });

    await this.clinicalRepo.saveMedication(medication);
    this.logger.info({ medicationId: medication.id }, "Medication created");
    return medication;
  }
}

export class UpdateMedicationUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    medicationId: string,
    action: "DISCONTINUE" | "ON_HOLD" | "RESUME",
  ): Promise<Medication> {
    const medication = await this.clinicalRepo.findMedicationById(medicationId);
    if (!medication) {
      throw new NotFoundError(`Medication ${medicationId} not found`);
    }

    if (action === "DISCONTINUE") {
      medication.discontinue();
    } else if (action === "ON_HOLD") {
      medication.putOnHold();
    } else if (action === "RESUME") {
      medication.resume();
    }

    await this.clinicalRepo.saveMedication(medication);
    this.logger.info(
      { medicationId: medication.id, status: medication.status },
      "Medication updated",
    );
    return medication;
  }
}

export class GetMedicationsForPatientUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(patientId: string): Promise<Medication[]> {
    const medications =
      await this.clinicalRepo.findMedicationsByPatientId(patientId);
    this.logger.info({ count: medications.length }, "Medications fetched");
    return medications;
  }
}
