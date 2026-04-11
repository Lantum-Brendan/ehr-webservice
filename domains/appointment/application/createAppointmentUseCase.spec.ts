import { beforeEach, describe, expect, it, vi } from "vitest";
import { type IAppointmentRepository } from "../domain/appointmentRepository.js";
import { type IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { type IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, ConflictError } from "@core/errors/appError.js";

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    provider: {
      findUnique: vi.fn(),
    },
    appointmentType: {
      findUnique: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
    clinicSettings: {
      findFirst: vi.fn(),
    },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { Appointment } = await import("../domain/appointmentEntity.js");
const { CreateAppointmentUseCase } =
  await import("./createAppointmentUseCase.js");

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

describe("CreateAppointmentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates appointment successfully", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
    });
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute({
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-1",
      scheduledStart: "2099-06-15T10:00:00.000Z",
      reason: "Annual checkup",
    });

    expect(result.patientId).toBe("patient-1");
    expect(result.providerId).toBe("provider-1");
    expect(result.appointmentTypeId).toBe("type-1");
    expect(result.durationMinutes).toBe(30);
    expect(result.status).toBe("SCHEDULED");
    expect(mockAppointmentRepo.save).toHaveBeenCalledWith(result);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AppointmentCreated",
        payload: expect.objectContaining({
          appointmentId: result.id,
          patientId: "patient-1",
          providerId: "provider-1",
        }),
      }),
    );
  });

  it("throws NotFoundError when patient not found", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "nonexistent-patient",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundError);

    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("throws NotFoundError when provider not found", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        providerId: "nonexistent-provider",
        appointmentTypeId: "type-1",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundError);

    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
  });

  it("throws ConflictError when provider is inactive", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: false,
    });

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("throws NotFoundError when appointment type not found", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "nonexistent-type",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundError);
  });

  it("throws ConflictError when appointment type is inactive", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: false,
    });

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(ConflictError);
  });

  it("throws ConflictError when time slot conflicts with existing appointment", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
    });
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      Appointment.rehydrate({
        id: "existing-appointment",
        patientId: "patient-2",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        durationMinutes: 30,
        locationId: null,
        scheduledStart: "2099-06-15T10:15:00.000Z",
        scheduledEnd: "2099-06-15T10:45:00.000Z",
        status: "SCHEDULED",
        reason: null,
        notes: null,
        createdAt: "2099-06-01T10:00:00.000Z",
        updatedAt: "2099-06-01T10:00:00.000Z",
      }),
    ]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(ConflictError);

    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
  });

  it("uses custom duration when provided", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
    });
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute({
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-1",
      durationMinutes: 60,
      scheduledStart: "2099-06-15T10:00:00.000Z",
    });

    expect(result.durationMinutes).toBe(60);
  });

  it("throws when location not found", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN001",
      firstNameValue: "John",
      lastNameValue: "Doe",
      dateOfBirthValue: new Date("1990-01-01"),
      age: 34,
    } as any);
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
    });
    (prisma.location.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo as IAppointmentRepository,
      mockPatientRepo as IPatientRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        locationId: "nonexistent-location",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
