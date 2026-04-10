import { describe, it, expect, vi, beforeEach } from "vitest";
import { type IPatientRepository } from "../domain/patientRepository";
import { type IEventBus } from "../../../shared/event-bus/event-bus.interface";
import { type Logger } from "../../../shared/logger/index";
import { ConflictError } from "../../../core/errors/appError";
import { Patient } from "../domain/patientEntity";

vi.mock("../../../../core/utils/dateUtils", () => ({
  calculateAge: vi.fn(() => 35),
  isMinor: vi.fn(() => false),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "patient-uuid-1"),
}));

const mockPatient = Patient.create({
  mrn: "MRN123",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-06-15",
});

const mockRepo: Partial<IPatientRepository> = {
  findByMrn: vi.fn(),
  findById: vi.fn(),
  findAll: vi.fn(),
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

const VALID_INPUT = {
  mrn: "MRN123",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-06-15",
};

import { CreatePatientUseCase } from "./createPatientUseCase";

describe("CreatePatientUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a patient when MRN is unique", async () => {
    (mockRepo.findByMrn as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new CreatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );
    const result = await useCase.execute(VALID_INPUT);

    expect(result).toEqual(mockPatient);
    expect(mockRepo.findByMrn).toHaveBeenCalledWith("MRN123");
    expect(mockRepo.save).toHaveBeenCalledWith(mockPatient);

    // Verify domain event was published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PatientCreated",
        aggregateId: "patient-uuid-1",
        aggregateType: "Patient",
        payload: expect.objectContaining({
          patientId: "patient-uuid-1",
          mrn: "MRN123",
          firstName: "John",
          lastName: "Doe",
        }),
      }),
    );
  });

  it("throws ConflictError when MRN already exists", async () => {
    (mockRepo.findByMrn as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    const useCase = new CreatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute(VALID_INPUT)).rejects.toThrow(ConflictError);
    await expect(useCase.execute(VALID_INPUT)).rejects.toThrow(
      "Patient with MRN MRN123 already exists",
    );

    // Should not save or publish
    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("logs warning when MRN conflict occurs", async () => {
    (mockRepo.findByMrn as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    const useCase = new CreatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute(VALID_INPUT)).rejects.toThrow(ConflictError);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      { mrn: "MRN123" },
      "Patient creation failed - MRN already exists",
    );
  });

  it("logs info on successful creation", async () => {
    (mockRepo.findByMrn as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new CreatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );
    await useCase.execute(VALID_INPUT);

    expect(mockLogger.info).toHaveBeenLastCalledWith(
      { patientId: "patient-uuid-1" },
      "Patient created successfully",
    );
  });
});
