import { Patient } from "../domain/patientEntity.js";
import { IPatientRepository } from "../domain/patientRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { ConflictError } from "@core/errors/appError.js";

interface CreatePatientInput {
  mrn: string;
  firstName: string;
  lastName: string;
  dateOfBirth: Date | string;
}

export class CreatePatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreatePatientInput): Promise<Patient> {
    this.logger.info({ input }, "Creating new patient");

    // Business rule: Check if MRN already exists
    const existingPatient = await this.patientRepo.findByMrn(input.mrn);
    if (existingPatient) {
      this.logger.warn(
        { mrn: input.mrn },
        "Patient creation failed - MRN already exists",
      );
      throw new ConflictError(`Patient with MRN ${input.mrn} already exists`);
    }

    // Create patient entity (validates business rules)
    const patient = Patient.create(input);

    // Save to repository
    await this.patientRepo.save(patient);

    // Publish domain event (fire-and-forget)
    await this.eventBus.publish({
      type: "PatientCreated",
      aggregateId: patient.id,
      aggregateType: "Patient",
      occurredOn: new Date(),
      payload: {
        patientId: patient.id,
        mrn: patient.mrn,
        firstName: patient.firstNameValue,
        lastName: patient.lastNameValue,
        dateOfBirth: patient.dateOfBirthValue.toISOString(),
      },
    });

    this.logger.info({ patientId: patient.id }, "Patient created successfully");
    return patient;
  }
}
