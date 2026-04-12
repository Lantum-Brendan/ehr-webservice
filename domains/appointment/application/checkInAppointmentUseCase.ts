import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ConflictError } from "@core/errors/appError.js";
import { Encounter } from "@domains/encounter/domain/encounterEntity.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class CheckInAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
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

    const typeRecord = await prisma.appointmentType.findUnique({
      where: { id: appointment.appointmentTypeId },
    });

    const encounter = Encounter.create({
      patientId: appointment.patientId,
      encounterType: "outpatient",
      startTime: new Date(),
      status: "arrived",
    });

    await prisma.encounter.create({
      data: {
        id: encounter.id,
        patientId: encounter.patientId,
        encounterType: encounter.encounterTypeValue,
        startTime: encounter.startTimeValue,
        endTime: encounter.endTimeValue,
        status: encounter.statusValue,
      },
    });

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
