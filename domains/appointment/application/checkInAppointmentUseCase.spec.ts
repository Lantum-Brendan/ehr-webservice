import { beforeEach, describe, expect, it, vi } from "vitest";
import { type IAppointmentRepository } from "../domain/appointmentRepository.js";
import { type IEncounterRepository } from "@domains/encounter/domain/encounterRepository.js";
import { type IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { ConflictError, NotFoundError } from "@core/errors/appError.js";
import { Appointment } from "../domain/appointmentEntity.js";
import { Encounter } from "@domains/encounter/domain/encounterEntity.js";

const { CheckInAppointmentUseCase } =
  await import("./checkInAppointmentUseCase.js");

const mockAppointmentRepo: Partial<IAppointmentRepository> = {
  findById: vi.fn(),
  findByPatientId: vi.fn(),
  findByProviderId: vi.fn(),
  findByDateRange: vi.fn(),
  findByProviderAndDateRange: vi.fn(),
  findOverlappingForProvider: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockEncounterRepo: Partial<IEncounterRepository> = {
  findById: vi.fn(),
  findByPatientId: vi.fn(),
  findByProviderId: vi.fn(),
  findByDateRange: vi.fn(),
  findByAppointmentId: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockEventBus: Partial<IEventBus> = {
  publish: vi.fn(),
  subscribe: vi.fn(() => () => {}),
  subscribeAll: vi.fn(() => () => {}),
  clear: vi.fn(),
};

const mockLogger: Partial<Logger> = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  silent: vi.fn(),
  child: vi.fn(() => mockLogger as Logger),
};

function makeScheduledAppointment() {
  return Appointment.rehydrate({
    id: "appointment-1",
    patientId: "patient-1",
    providerId: "provider-1",
    appointmentTypeId: "type-1",
    durationMinutes: 30,
    locationId: "location-1",
    scheduledStart: "2099-06-15T10:00:00.000Z",
    scheduledEnd: "2099-06-15T10:30:00.000Z",
    status: "SCHEDULED",
    reason: "Checkup",
    notes: null,
    createdAt: "2099-06-01T10:00:00.000Z",
    updatedAt: "2099-06-01T10:00:00.000Z",
  });
}

function makeConfirmedAppointment() {
  return Appointment.rehydrate({
    id: "appointment-1",
    patientId: "patient-1",
    providerId: "provider-1",
    appointmentTypeId: "type-1",
    durationMinutes: 30,
    locationId: "location-1",
    scheduledStart: "2099-06-15T10:00:00.000Z",
    scheduledEnd: "2099-06-15T10:30:00.000Z",
    status: "CONFIRMED",
    reason: "Checkup",
    notes: null,
    createdAt: "2099-06-01T10:00:00.000Z",
    updatedAt: "2099-06-01T10:00:00.000Z",
  });
}

function makeCheckedInAppointment() {
  return Appointment.rehydrate({
    id: "appointment-1",
    patientId: "patient-1",
    providerId: "provider-1",
    appointmentTypeId: "type-1",
    durationMinutes: 30,
    locationId: "location-1",
    scheduledStart: "2099-06-15T10:00:00.000Z",
    scheduledEnd: "2099-06-15T10:30:00.000Z",
    status: "CHECKED_IN",
    reason: "Checkup",
    notes: null,
    createdAt: "2099-06-01T10:00:00.000Z",
    updatedAt: "2099-06-01T10:00:00.000Z",
  });
}

describe("CheckInAppointmentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("checks in a scheduled appointment and creates encounter", async () => {
    const appointment = makeScheduledAppointment();
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(appointment);

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute("appointment-1");

    expect(result.status).toBe("CHECKED_IN");
    expect(mockAppointmentRepo.save).toHaveBeenCalledWith(result);
    expect(mockEncounterRepo.save).toHaveBeenCalled();
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AppointmentCheckedIn",
        payload: expect.objectContaining({
          appointmentId: "appointment-1",
          patientId: "patient-1",
          encounterId: expect.any(String),
        }),
      }),
    );
  });

  it("checks in a confirmed appointment and creates encounter", async () => {
    const appointment = makeConfirmedAppointment();
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(appointment);

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute("appointment-1");

    expect(result.status).toBe("CHECKED_IN");
    expect(mockEncounterRepo.save).toHaveBeenCalled();
  });

  it("throws NotFoundError when appointment does not exist", async () => {
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute("nonexistent")).rejects.toThrow(NotFoundError);
    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
    expect(mockEncounterRepo.save).not.toHaveBeenCalled();
  });

  it("throws ConflictError when appointment is already checked in", async () => {
    const appointment = makeCheckedInAppointment();
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(appointment);

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute("appointment-1")).rejects.toThrow(
      ConflictError,
    );
    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
    expect(mockEncounterRepo.save).not.toHaveBeenCalled();
  });

  it("throws ConflictError when appointment is completed", async () => {
    const appointment = Appointment.rehydrate({
      id: "appointment-1",
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-1",
      durationMinutes: 30,
      locationId: "location-1",
      scheduledStart: "2099-06-15T10:00:00.000Z",
      scheduledEnd: "2099-06-15T10:30:00.000Z",
      status: "COMPLETED",
      reason: "Checkup",
      notes: null,
      createdAt: "2099-06-01T10:00:00.000Z",
      updatedAt: "2099-06-01T10:00:00.000Z",
    });
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(appointment);

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute("appointment-1")).rejects.toThrow(
      ConflictError,
    );
    expect(mockEncounterRepo.save).not.toHaveBeenCalled();
  });

  it("throws ConflictError when appointment is cancelled", async () => {
    const appointment = Appointment.rehydrate({
      id: "appointment-1",
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-1",
      durationMinutes: 30,
      locationId: "location-1",
      scheduledStart: "2099-06-15T10:00:00.000Z",
      scheduledEnd: "2099-06-15T10:30:00.000Z",
      status: "CANCELLED_BY_PATIENT",
      reason: "Checkup",
      notes: null,
      createdAt: "2099-06-01T10:00:00.000Z",
      updatedAt: "2099-06-01T10:00:00.000Z",
    });
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(appointment);

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute("appointment-1")).rejects.toThrow(
      ConflictError,
    );
    expect(mockEncounterRepo.save).not.toHaveBeenCalled();
  });

  it("creates encounter with correct patient and encounter type", async () => {
    const appointment = makeScheduledAppointment();
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(appointment);

    let savedEncounter: Encounter | undefined;
    (mockEncounterRepo.save as ReturnType<typeof vi.fn>).mockImplementation(
      async (encounter: Encounter) => {
        savedEncounter = encounter;
      },
    );

    const useCase = new CheckInAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockEncounterRepo as IEncounterRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await useCase.execute("appointment-1");

    expect(mockEncounterRepo.save).toHaveBeenCalled();
    expect(savedEncounter?.patientId).toBe("patient-1");
    expect(savedEncounter?.encounterTypeValue).toBe("outpatient");
    expect(savedEncounter?.statusValue).toBe("arrived");
  });
});
