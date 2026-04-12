import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError, NotFoundError } from "@core/errors/appError.js";
import type { IPatientRepository } from "@domains/patient/domain/patientRepository.js";
import { type IEventBus } from "@shared/event-bus/event-bus.interface.js";
import { type Logger } from "@shared/logger/index.js";

import { Appointment } from "../domain/appointmentEntity.js";
import type { IAppointmentRepository } from "../domain/appointmentRepository.js";
import { ProviderSchedule } from "../domain/providerSchedule.js";
import { ScheduleBlock } from "../domain/scheduleBlock.js";
import {
  type IProviderScheduleRepository,
  type IScheduleBlockRepository,
} from "../domain/scheduleRepository.js";

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    provider: { findUnique: vi.fn() },
    appointmentType: { findUnique: vi.fn() },
    location: { findUnique: vi.fn() },
    clinicSettings: { findFirst: vi.fn() },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { CreateAppointmentUseCase } =
  await import("./createAppointmentUseCase.js");

const mockPatientRepo: Partial<IPatientRepository> = {
  findById: vi.fn(),
  findByMrn: vi.fn(),
  findAll: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockAppointmentRepo: IAppointmentRepository = {
  findById: vi.fn(),
  findByPatientId: vi.fn(),
  findByProviderId: vi.fn(),
  findByDateRange: vi.fn(),
  findByProviderAndDateRange: vi.fn(),
  findOverlappingForProvider: vi.fn(),
  withSerializableTransaction: vi.fn(),
  save: vi.fn(),
  delete: vi.fn(),
};

const mockScheduleRepo: IProviderScheduleRepository = {
  findByProviderId: vi.fn(),
  findByProviderAndDay: vi.fn(),
};

const mockBlockRepo: IScheduleBlockRepository = {
  findByProviderId: vi.fn(),
  findByProviderAndDateRange: vi.fn(),
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

function makePatient() {
  return {
    id: "patient-1",
    mrn: "MRN001",
    firstNameValue: "John",
    lastNameValue: "Doe",
    dateOfBirthValue: new Date("1990-01-01"),
    age: 34,
  } as any;
}

function makeMondaySchedule(startTime: string, endTime: string) {
  return ProviderSchedule.create({
    providerId: "provider-1",
    dayOfWeek: 1,
    startTime,
    endTime,
  });
}

describe("CreateAppointmentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      mockAppointmentRepo.withSerializableTransaction as ReturnType<
        typeof vi.fn
      >
    ).mockImplementation(async (operation) => operation(mockAppointmentRepo));
  });

  it("creates an appointment inside a matching schedule window", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatient(),
    );
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
      patientSelfBookingEnabled: true,
      maxAdvanceBookingDays: 30,
    });
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeMondaySchedule("09:00", "17:00")]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
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
    expect(
      mockAppointmentRepo.withSerializableTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(mockAppointmentRepo.save).toHaveBeenCalledWith(result);
  });

  it("throws NotFoundError when the patient does not exist", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      null,
    );

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "missing-patient",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        scheduledStart: "2099-06-15T10:00:00.000Z",
      }),
    ).rejects.toThrow(NotFoundError);

    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it("throws ConflictError when the provider is inactive", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatient(),
    );
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: false,
      selfBookingEnabled: true,
    });

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
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

  it("throws ConflictError when there is no schedule for the day", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatient(),
    );
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
      patientSelfBookingEnabled: true,
      maxAdvanceBookingDays: 30,
    });
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
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

  it("accepts appointments that fit a later split-shift window", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatient(),
    );
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
      patientSelfBookingEnabled: true,
      maxAdvanceBookingDays: 30,
    });
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      makeMondaySchedule("09:00", "12:00"),
      makeMondaySchedule("14:00", "17:00"),
    ]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute({
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-1",
      scheduledStart: "2099-06-15T15:00:00.000Z",
    });

    expect(result.scheduledStart.toISOString()).toBe(
      "2099-06-15T15:00:00.000Z",
    );
    expect(mockAppointmentRepo.save).toHaveBeenCalledWith(result);
  });

  it("rejects blocked time slots before attempting the transaction", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatient(),
    );
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
      patientSelfBookingEnabled: true,
      maxAdvanceBookingDays: 30,
    });
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeMondaySchedule("09:00", "17:00")]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      ScheduleBlock.create({
        providerId: "provider-1",
        startDateTime: "2099-06-15T10:00:00.000Z",
        endDateTime: "2099-06-15T10:30:00.000Z",
        reason: "Team meeting",
      }),
    ]);

    const useCase = new CreateAppointmentUseCase(
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
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
    ).rejects.toThrow(
      "This time slot is blocked. Please choose a different time.",
    );

    expect(
      mockAppointmentRepo.withSerializableTransaction,
    ).not.toHaveBeenCalled();
    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
  });

  it("throws on overlap conflicts inside the serializable transaction", async () => {
    (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatient(),
    );
    (prisma.provider.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "provider-1",
      name: "Dr. Smith",
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-1",
      name: "Checkup",
      defaultDurationMinutes: 30,
      isActive: true,
      selfBookingEnabled: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
      patientSelfBookingEnabled: true,
      maxAdvanceBookingDays: 30,
    });
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeMondaySchedule("09:00", "17:00")]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
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
      mockAppointmentRepo,
      mockPatientRepo as IPatientRepository,
      mockScheduleRepo,
      mockBlockRepo,
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

    expect(
      mockAppointmentRepo.withSerializableTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
  });

  describe("self-booking validation", () => {
    it("rejects self-booking when clinic setting is disabled", async () => {
      (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePatient(),
      );
      (
        prisma.provider.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "provider-1",
        name: "Dr. Smith",
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "type-1",
        name: "Checkup",
        defaultDurationMinutes: 30,
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        appointmentBufferMinutes: 0,
        patientSelfBookingEnabled: false,
        maxAdvanceBookingDays: 30,
      });

      const useCase = new CreateAppointmentUseCase(
        mockAppointmentRepo,
        mockPatientRepo as IPatientRepository,
        mockScheduleRepo,
        mockBlockRepo,
        mockEventBus as IEventBus,
        mockLogger as Logger,
      );

      await expect(
        useCase.execute({
          patientId: "patient-1",
          providerId: "provider-1",
          appointmentTypeId: "type-1",
          scheduledStart: "2099-06-15T10:00:00.000Z",
          isSelfBooking: true,
        }),
      ).rejects.toThrow("Patient self-booking is not currently enabled");
    });

    it("rejects self-booking when appointment type is not self-bookable", async () => {
      (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePatient(),
      );
      (
        prisma.provider.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "provider-1",
        name: "Dr. Smith",
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "type-1",
        name: "Procedure",
        defaultDurationMinutes: 60,
        isActive: true,
        selfBookingEnabled: false,
      });
      (
        prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        appointmentBufferMinutes: 0,
        patientSelfBookingEnabled: true,
        maxAdvanceBookingDays: 30,
      });

      const useCase = new CreateAppointmentUseCase(
        mockAppointmentRepo,
        mockPatientRepo as IPatientRepository,
        mockScheduleRepo,
        mockBlockRepo,
        mockEventBus as IEventBus,
        mockLogger as Logger,
      );

      await expect(
        useCase.execute({
          patientId: "patient-1",
          providerId: "provider-1",
          appointmentTypeId: "type-1",
          scheduledStart: "2099-06-15T10:00:00.000Z",
          isSelfBooking: true,
        }),
      ).rejects.toThrow("This appointment type cannot be booked by patients");
    });

    it("rejects self-booking when provider does not allow self-booking", async () => {
      (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePatient(),
      );
      (
        prisma.provider.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "provider-1",
        name: "Dr. Smith",
        isActive: true,
        selfBookingEnabled: false,
      });
      (
        prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "type-1",
        name: "Checkup",
        defaultDurationMinutes: 30,
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        appointmentBufferMinutes: 0,
        patientSelfBookingEnabled: true,
        maxAdvanceBookingDays: 30,
      });

      const useCase = new CreateAppointmentUseCase(
        mockAppointmentRepo,
        mockPatientRepo as IPatientRepository,
        mockScheduleRepo,
        mockBlockRepo,
        mockEventBus as IEventBus,
        mockLogger as Logger,
      );

      await expect(
        useCase.execute({
          patientId: "patient-1",
          providerId: "provider-1",
          appointmentTypeId: "type-1",
          scheduledStart: "2099-06-15T10:00:00.000Z",
          isSelfBooking: true,
        }),
      ).rejects.toThrow("This provider does not accept patient self-booking");
    });

    it("rejects self-booking when date is beyond max advance booking days", async () => {
      (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePatient(),
      );
      (
        prisma.provider.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "provider-1",
        name: "Dr. Smith",
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "type-1",
        name: "Checkup",
        defaultDurationMinutes: 30,
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        appointmentBufferMinutes: 0,
        patientSelfBookingEnabled: true,
        maxAdvanceBookingDays: 30,
      });

      const useCase = new CreateAppointmentUseCase(
        mockAppointmentRepo,
        mockPatientRepo as IPatientRepository,
        mockScheduleRepo,
        mockBlockRepo,
        mockEventBus as IEventBus,
        mockLogger as Logger,
      );

      const farFutureDate = new Date();
      farFutureDate.setDate(farFutureDate.getDate() + 60);

      await expect(
        useCase.execute({
          patientId: "patient-1",
          providerId: "provider-1",
          appointmentTypeId: "type-1",
          scheduledStart: farFutureDate.toISOString(),
          isSelfBooking: true,
        }),
      ).rejects.toThrow("Appointments can only be booked 30 days in advance");
    });

    it("rejects self-booking when date is in the past", async () => {
      (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePatient(),
      );
      (
        prisma.provider.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "provider-1",
        name: "Dr. Smith",
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "type-1",
        name: "Checkup",
        defaultDurationMinutes: 30,
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        appointmentBufferMinutes: 0,
        patientSelfBookingEnabled: true,
        maxAdvanceBookingDays: 30,
      });

      const useCase = new CreateAppointmentUseCase(
        mockAppointmentRepo,
        mockPatientRepo as IPatientRepository,
        mockScheduleRepo,
        mockBlockRepo,
        mockEventBus as IEventBus,
        mockLogger as Logger,
      );

      await expect(
        useCase.execute({
          patientId: "patient-1",
          providerId: "provider-1",
          appointmentTypeId: "type-1",
          scheduledStart: "2020-01-01T10:00:00.000Z",
          isSelfBooking: true,
        }),
      ).rejects.toThrow("Cannot book appointments in the past");
    });

    it("allows self-booking when all validations pass", async () => {
      (mockPatientRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
        makePatient(),
      );
      (
        prisma.provider.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "provider-1",
        name: "Dr. Smith",
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        id: "type-1",
        name: "Checkup",
        defaultDurationMinutes: 30,
        isActive: true,
        selfBookingEnabled: true,
      });
      (
        prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
      ).mockResolvedValue({
        appointmentBufferMinutes: 0,
        patientSelfBookingEnabled: true,
        maxAdvanceBookingDays: 30,
      });
      (
        mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
      ).mockResolvedValue([makeMondaySchedule("09:00", "17:00")]);
      (
        mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
      ).mockResolvedValue([]);
      (
        mockAppointmentRepo.findOverlappingForProvider as ReturnType<
          typeof vi.fn
        >
      ).mockResolvedValue([]);

      const useCase = new CreateAppointmentUseCase(
        mockAppointmentRepo,
        mockPatientRepo as IPatientRepository,
        mockScheduleRepo,
        mockBlockRepo,
        mockEventBus as IEventBus,
        mockLogger as Logger,
      );

      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);

      const result = await useCase.execute({
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        scheduledStart: tomorrow.toISOString(),
        isSelfBooking: true,
      });

      expect(result.patientId).toBe("patient-1");
      expect(mockAppointmentRepo.save).toHaveBeenCalledWith(result);
    });
  });
});
