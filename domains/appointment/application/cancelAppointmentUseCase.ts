import { Appointment } from "../domain/appointmentEntity.js";
import { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import {
  ConflictError,
  NotFoundError,
  ForbiddenError,
} from "@core/errors/appError.ts";
import { getAppointmentClinicSettings } from "../infrastructure/appointmentClinicSettings.js";

interface CancelAppointmentInput {
  cancelledBy: string;
  reason?: string;
  isPatientCancel: boolean;
}

export class CancelAppointmentUseCase {
  constructor(
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(
    id: string,
    input: CancelAppointmentInput,
    preloadedAppointment?: Appointment,
  ): Promise<Appointment> {
    this.logger.info(
      { appointmentId: id, cancelledBy: input.cancelledBy },
      "Cancelling appointment",
    );
    const now = new Date();

    const appointment =
      preloadedAppointment ?? (await this.appointmentRepo.findById(id));
    if (!appointment) {
      this.logger.warn({ appointmentId: id }, "Appointment not found");
      throw new NotFoundError(`Appointment with ID ${id} not found`);
    }

    if (!appointment.isCancellable) {
      throw new ConflictError(
        `Cannot cancel appointment with status ${appointment.status}`,
      );
    }

    const settings = await getAppointmentClinicSettings();
    const cutoffHours = settings.cancellationCutoffHours;

    if (input.isPatientCancel) {
      const hoursUntilAppointment =
        (appointment.scheduledStart.getTime() - now.getTime()) /
        (1000 * 60 * 60);

      if (hoursUntilAppointment < cutoffHours) {
        this.logger.warn(
          { appointmentId: id, hoursUntilAppointment, cutoffHours },
          "Cancellation outside patient cutoff window",
        );
        throw new ForbiddenError(
          `Patients must cancel at least ${cutoffHours} hours before the appointment. Please contact reception.`,
        );
      }
    }

    appointment.cancel(
      input.cancelledBy,
      input.reason,
      input.isPatientCancel,
      now,
    );

    await this.appointmentRepo.save(appointment);

    await this.eventBus.publish({
      type: "AppointmentCancelled",
      aggregateId: appointment.id,
      aggregateType: "Appointment",
      occurredOn: new Date(),
      payload: {
        appointmentId: appointment.id,
        patientId: appointment.patientId,
        cancelledBy: input.cancelledBy,
        reason: input.reason,
        cancelledByPatient: input.isPatientCancel,
        status: appointment.status,
      },
    });

    this.logger.info(
      { appointmentId: appointment.id },
      "Appointment cancelled successfully",
    );

    return appointment;
  }
}
