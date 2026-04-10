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

import { DeletePatientUseCase } from "./deletePatientUseCase";

describe("DeletePatientUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes the patient when patient exists", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    const useCase = new DeletePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );
    await useCase.execute("patient-uuid-1");

    expect(mockRepo.findById).toHaveBeenCalledWith("patient-uuid-1");
    expect(mockRepo.delete).toHaveBeenCalledWith("patient-uuid-1");
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "PatientDeleted",
        aggregateId: "patient-uuid-1",
        aggregateType: "Patient",
        payload: expect.objectContaining({
          patientId: "patient-uuid-1",
          mrn: "MRN123",
        }),
      }),
    );
  });

  it("throws NotFoundError when patient does not exist", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new DeletePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute("nonexistent-id")).rejects.toThrow(
      NotFoundError,
    );
    await expect(useCase.execute("nonexistent-id")).rejects.toThrow(
      "Patient with ID nonexistent-id not found",
    );

    expect(mockRepo.delete).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("logs warning when patient not found", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const useCase = new DeletePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(useCase.execute("nonexistent-id")).rejects.toThrow(
      NotFoundError,
    );

    expect(mockLogger.warn).toHaveBeenCalledWith(
      { patientId: "nonexistent-id" },
      "Delete failed - patient not found",
    );
  });

  it("logs info on successful deletion", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockPatient,
    );

    const useCase = new DeletePatientUseCase(
      mockRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );
    await useCase.execute("patient-uuid-1");

    expect(mockLogger.info).toHaveBeenCalledWith(
      { patientId: "patient-uuid-1" },
      "Patient deleted successfully",
    );
  });
});
