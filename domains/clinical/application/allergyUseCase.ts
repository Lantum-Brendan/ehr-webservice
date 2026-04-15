import {
  Allergy,
  AllergyType,
  AllergySeverity,
} from "../domain/allergyEntity.js";
import { IClinicalRepository } from "../domain/clinicalRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.js";

interface CreateAllergyInput {
  patientId: string;
  allergen: string;
  type: string;
  severity: string;
  reaction?: string;
  recordedBy: string;
}

export class CreateAllergyUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateAllergyInput): Promise<Allergy> {
    this.logger.info(
      { patientId: input.patientId, allergen: input.allergen },
      "Creating allergy",
    );

    const allergy = Allergy.create({
      ...input,
      type: input.type as AllergyType,
      severity: input.severity as AllergySeverity,
    });

    await this.clinicalRepo.saveAllergy(allergy);
    this.logger.info({ allergyId: allergy.id }, "Allergy created");
    return allergy;
  }
}

export class UpdateAllergyUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    allergyId: string,
    action: "DEACTIVATE" | "RESOLVE",
  ): Promise<Allergy> {
    const allergy = await this.clinicalRepo.findAllergyById(allergyId);
    if (!allergy) {
      throw new NotFoundError(`Allergy ${allergyId} not found`);
    }

    if (action === "RESOLVE") {
      allergy.resolve();
    } else if (action === "DEACTIVATE") {
      allergy.deactivate();
    }

    await this.clinicalRepo.saveAllergy(allergy);
    this.logger.info(
      { allergyId: allergy.id, status: allergy.status },
      "Allergy updated",
    );
    return allergy;
  }
}

export class GetAllergiesForPatientUseCase {
  constructor(
    private readonly clinicalRepo: IClinicalRepository,
    private readonly logger: Logger,
  ) {}

  async execute(patientId: string): Promise<Allergy[]> {
    const allergies =
      await this.clinicalRepo.findAllergiesByPatientId(patientId);
    this.logger.info({ count: allergies.length }, "Allergies fetched");
    return allergies;
  }
}
