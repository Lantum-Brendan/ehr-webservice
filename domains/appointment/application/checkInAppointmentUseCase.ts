import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { type IEncounterRepository } from "@domains/encounter/domain/encounterRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ConflictError } from "@core/errors/appError.js";
import { Encounter } from "@domains/encounter/domain/encounterEntity.js";

export class CheckInAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly encounterRepo: IEncounterRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(id: string): Promise<Appointment> {
    this.logger.info({ appointmentId: id }, "Checking in appointment");

    const appointment = await this.appointmentRepo.findById(id);
    if (!appointment) {
      this.logger.warn({ appointmentId: id }, "Appointment not found");
      throw new NotFoundError(`Appointment with ID ${id} not found`);
    }

    if (
      appointment.status !== "SCHEDULED" &&
      appointment.status !== "CONFIRMED"
    ) {
      throw new ConflictError(
        `Cannot check in appointment with status ${appointment.status}. Only scheduled or confirmed appointments can be checked in.`,
      );
    }

    appointment.checkIn();
    await this.appointmentRepo.save(appointment);

    const encounter = Encounter.create({
      patientId: appointment.patientId,
      encounterType: "outpatient",
      startTime: new Date(),
      status: "arrived",
    });

    await this.encounterRepo.save(encounter);

    await this.eventBus.publish({
      type: "AppointmentCheckedIn",
      aggregateId: appointment.id,
      aggregateType: "Appointment",
      occurredOn: new Date(),
      payload: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        providerId: appointment.providerId,
        scheduledStart: appointment.scheduledStart.toISOString(),
        status: appointment.status,
        encounterId: encounter.id,
      },
    });

    this.logger.info(
      { appointmentId: appointment.id, encounterId: encounter.id },
      "Appointment checked in and encounter created",
    );

    return appointment;
  }
}
