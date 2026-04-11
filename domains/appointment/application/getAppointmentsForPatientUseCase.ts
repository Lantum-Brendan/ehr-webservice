import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { NotFoundError } from "@core/errors/appError.js";

export class GetAppointmentsForPatientUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly patientRepo: IPatientRepository,
  ) {}

  async execute(patientId: string): Promise<Appointment[]> {
    const patient = await this.patientRepo.findById(patientId);

    if (!patient) {
      throw new NotFoundError(`Patient with ID ${patientId} not found`);
    }

    return this.appointmentRepo.findByPatientId(patientId);
  }
}
