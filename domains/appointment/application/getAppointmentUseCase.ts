import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { NotFoundError } from "@core/errors/appError.js";

export class GetAppointmentUseCase {
  constructor(private readonly appointmentRepo: IAppointmentRepository) {}

  async execute(id: string): Promise<Appointment> {
    const appointment = await this.appointmentRepo.findById(id);

    if (!appointment) {
      throw new NotFoundError(`Appointment with ID ${id} not found`);
    }

    return appointment;
  }
}
