import { Patient } from "../domain/patientEntity.js";
import { IPatientRepository } from "../domain/patientRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.ts";

interface UpdatePatientInput {
  firstName: string;
  lastName: string;
}

export class UpdatePatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(id: string, input: UpdatePatientInput): Promise<Patient> {
    this.logger.info({ patientId: id }, "Updating patient");

    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      this.logger.warn({ patientId: id }, "Update failed - patient not found");
      throw new NotFoundError(`Patient with ID ${id} not found`);
    }

    patient.updateName(input.firstName, input.lastName);

    await this.patientRepo.save(patient);

    await this.eventBus.publish({
      type: "PatientUpdated",
      aggregateId: patient.id,
      aggregateType: "Patient",
      occurredOn: new Date(),
      payload: {
        patientId: patient.id,
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
      },
    });

    this.logger.info({ patientId: patient.id }, "Patient updated successfully");
    return patient;
  }
}
