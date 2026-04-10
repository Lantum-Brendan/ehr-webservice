import { describe, it, expect, vi, beforeEach } from "vitest";
import { type IPatientRepository } from "../domain/patientRepository";
import { type IEventBus } from "../../../shared/event-bus/event-bus.interface";
import { type Logger } from "../../../shared/logger/index";
import { NotFoundError } from "../../../core/errors/appError";
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
  findById: vi.fn(),
  findByMrn: vi.fn(),
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

const VALID_UPDATE_INPUT = {
  firstName: "Jane",
  lastName: "Smith",
};

import { UpdatePatientUseCase } from "./updatePatientUseCase";

describe("UpdatePatientUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates the patient name when patient exists", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    const useCase = new UpdatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );
    const result = await useCase.execute("patient-uuid-1", VALID_UPDATE_INPUT);

    expect(mockRepo.findById).toHaveBeenCalledWith("patient-uuid-1");
    expect(mockPatient.firstNameValue).toBe("Jane");
    expect(mockPatient.lastNameValue).toBe("Smith");
    expect(mockRepo.save).toHaveBeenCalledWith(mockPatient);
    expect(result).toBe(mockPatient);

    // Verify event published
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PatientUpdated",
        aggregateId: "patient-uuid-1",
        aggregateType: "Patient",
        payload: expect.objectContaining({
          patientId: "patient-uuid-1",
          firstName: "Jane",
          lastName: "Smith",
        }),
      }),
    );
  });

  it("throws NotFoundError when patient does not exist", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new UpdatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute("nonexistent-id", VALID_UPDATE_INPUT),
    ).rejects.toThrow(NotFoundError);

    await expect(
      useCase.execute("nonexistent-id", VALID_UPDATE_INPUT),
    ).rejects.toThrow("Patient with ID nonexistent-id not found");

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("throws when entity validation fails (empty name)", async () => {
    const useCase = new UpdatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    // Mock patient exists, but update will fail validation
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    await expect(
      useCase.execute("patient-uuid-1", { firstName: "", lastName: "Smith" }),
    ).rejects.toThrow("First and last name are required");

    expect(mockRepo.save).not.toHaveBeenCalled();
  });

  it("logs warning when patient not found", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new UpdatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute("nonexistent-id", VALID_UPDATE_INPUT),
    ).rejects.toThrow(NotFoundError);

    expect(mockLogger.warn).toHaveBeenCalledWith(
      { patientId: "nonexistent-id" },
      "Update failed - patient not found",
    );
  });

  it("logs info on successful update", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    const useCase = new UpdatePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );
    await useCase.execute("patient-uuid-1", VALID_UPDATE_INPUT);

    expect(mockLogger.info).toHaveBeenCalledWith(
      { patientId: "patient-uuid-1" },
      "Patient updated successfully",
    );
  });
});
