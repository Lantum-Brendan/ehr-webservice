import { beforeEach, describe, expect, it, vi } from "vitest";
import { Appointment } from "@domains/appointment/domain/appointmentEntity.js";
import { type IAppointmentRepository } from "@domains/appointment/domain/appointmentRepository.js";
import { type IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { BadRequestError, ConflictError } from "@core/errors/appError.js";
import { type IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { type IEncounterRepository } from "../domain/encounterRepository.js";

const { CreateEncounterUseCase } = await import("./createEncounterUseCase.js");

const mockEncounterRepo: Partial<IEncounterRepository> = {
  findById: vi.fn(),
  findByPatientId: vi.fn(),
  findByProviderId: vi.fn(),
  findByDateRange: vi.fn(),
  findByAppointmentId: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockPatientRepo: Partial<IPatientRepository> = {
  findById: vi.fn(),
  findByMrn: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

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

function makeAppointment(patientId = "11111111-1111-1111-1111-111111111111") {
  return Appointment.rehydrate({
    id: "appointment-1",
    patientId,
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

describe("CreateEncounterUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "11111111-1111-1111-1111-111111111111",
    });
    (mockEncounterRepo.findByAppointmentId as ReturnType<typeof vi.fn>)
      .mockResolvedValue(null);
  });

  it("creates an encounter linked to an appointment and derives providerId", async () => {
    (mockAppointmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeAppointment(),
    );

    const useCase = new CreateEncounterUseCase(
      mockEncounterRepo as IEncounterRepository,
      mockPatientRepo as IPatientRepository,
      mockAppointmentRepo as IAppointmentRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const encounter = await useCase.execute({
      patientId: "11111111-1111-1111-1111-111111111111",
      appointmentId: "appointment-1",
      encounterType: "outpatient",
    });

    expect(encounter.appointmentId).toBe("appointment-1");
    expect(encounter.providerId).toBe("provider-1");
    expect(mockEncounterRepo.save).toHaveBeenCalledWith(encounter);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "EncounterCreated",
        payload: expect.objectContaining({
          appointmentId: "appointment-1",
          providerId: "provider-1",
        }),
      }),
    );
  });

  it("rejects a linked appointment for another patient", async () => {
    (mockAppointmentRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makeAppointment("22222222-2222-2222-2222-222222222222"),
    );

    const useCase = new CreateEncounterUseCase(
      mockEncounterRepo as IEncounterRepository,
      mockPatientRepo as IPatientRepository,
      mockAppointmentRepo as IAppointmentRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "11111111-1111-1111-1111-111111111111",
        appointmentId: "appointment-1",
        encounterType: "outpatient",
      }),
    ).rejects.toThrow(BadRequestError);
  });

  it("rejects duplicate encounter creation for an appointment", async () => {
    (mockEncounterRepo.findByAppointmentId as ReturnType<typeof vi.fn>)
      .mockResolvedValue({ id: "encounter-existing" });

    const useCase = new CreateEncounterUseCase(
      mockEncounterRepo as IEncounterRepository,
      mockPatientRepo as IPatientRepository,
      mockAppointmentRepo as IAppointmentRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "11111111-1111-1111-1111-111111111111",
        appointmentId: "appointment-1",
        encounterType: "outpatient",
      }),
    ).rejects.toThrow(ConflictError);
  });
});
