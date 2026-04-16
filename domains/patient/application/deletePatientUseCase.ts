import { IPatientRepository } from "../domain/patientRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.ts";

export class DeletePatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<void> {
    this.logger.info({ patientId: id }, "Deleting patient");

    const patient = await this.patientRepo.findById(id);
    if (!patient) {
      this.logger.warn({ patientId: id }, "Delete failed - patient not found");
      throw new NotFoundError(`Patient with ID ${id} not found`);
    }

    await this.patientRepo.delete(id);

    await this.eventBus.publish({
      type: "PatientDeleted",
      aggregateId: patient.id,
      aggregateType: "Patient",
      occurredOn: new Date(),
      payload: {
        patientId: patient.id,
        mrn: patient.mrn,
      },
    });

    this.logger.info({ patientId: id }, "Patient deleted successfully");
  }
}
