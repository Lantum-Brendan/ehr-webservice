import { Appointment } from "@domains/appointment/domain/appointmentEntity.js";
import { type IAppointmentRepository } from "@domains/appointment/domain/appointmentRepository.js";
import { type IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { BadRequestError, ConflictError, NotFoundError } from "@core/errors/appError.js";
import { Encounter } from "../domain/encounterEntity.js";
import { type IEncounterRepository } from "../domain/encounterRepository.js";
import { IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";

interface CreateEncounterInput {
  patientId: string;
  appointmentId?: string;
  providerId?: string;
  encounterType: string;
  startTime?: Date | string;
  endTime?: Date | string;
  status?: string;
}

function getAppointmentProviderId(
  appointment: Appointment | null,
  requestedProviderId: string | undefined,
): string | undefined {
  if (!appointment) {
    return requestedProviderId;
  }

  if (
    requestedProviderId &&
    requestedProviderId !== appointment.providerId
  ) {
    throw new BadRequestError(
      "Provider ID does not match the linked appointment",
    );
  }

  return requestedProviderId ?? appointment.providerId;
}

export class CreateEncounterUseCase {
  constructor(
    private readonly encounterRepo: IEncounterRepository,
    private readonly patientRepo: IPatientRepository,
    private readonly appointmentRepo: IAppointmentRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateEncounterInput): Promise<Encounter> {
    this.logger.info({ input }, "Creating encounter");

    const patient = await this.patientRepo.findById(input.patientId);
    if (!patient) {
      throw new NotFoundError(`Patient ${input.patientId} not found`);
    }

    let appointment: Appointment | null = null;
    if (input.appointmentId) {
      const existingEncounter = await this.encounterRepo.findByAppointmentId(
        input.appointmentId,
      );
      if (existingEncounter) {
        throw new ConflictError(
          `Encounter already exists for appointment ${input.appointmentId}`,
        );
      }

      appointment = await this.appointmentRepo.findById(input.appointmentId);
      if (!appointment) {
        throw new NotFoundError(
          `Appointment with ID ${input.appointmentId} not found`,
        );
      }

      if (appointment.patientId !== input.patientId) {
        throw new BadRequestError(
          "Patient ID does not match the linked appointment",
        );
      }
    }

    const encounter = Encounter.create({
      patientId: input.patientId,
      appointmentId: input.appointmentId,
      providerId: getAppointmentProviderId(appointment, input.providerId),
      encounterType: input.encounterType,
      startTime: input.startTime ?? new Date(),
      endTime: input.endTime,
      status: input.status,
    });

    await this.encounterRepo.save(encounter);

    await this.eventBus.publish({
      type: "EncounterCreated",
      aggregateId: encounter.id,
      aggregateType: "Encounter",
      occurredOn: new Date(),
      payload: {
        encounterId: encounter.id,
        patientId: encounter.patientId,
        appointmentId: encounter.appointmentId,
        providerId: encounter.providerId,
        encounterType: encounter.encounterTypeValue,
        status: encounter.statusValue,
      },
    });

    this.logger.info({ encounterId: encounter.id }, "Encounter created");
    return encounter;
  }
}
