import { beforeEach, describe, expect, it, vi } from "vitest";

import { ConflictError } from "@core/errors/appError.js";
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
const { UpdateAppointmentUseCase } =
  await import("./updateAppointmentUseCase.js");

const baseAppointment = Appointment.rehydrate({
  id: "appointment-1",
  patientId: "patient-1",
  providerId: "provider-1",
  appointmentTypeId: "type-old",
  durationMinutes: 30,
  locationId: "location-old",
  scheduledStart: "2099-01-01T10:00:00.000Z",
  scheduledEnd: "2099-01-01T10:30:00.000Z",
  status: "SCHEDULED",
  reason: "Initial reason",
  notes: "Initial notes",
  createdAt: "2098-12-30T10:00:00.000Z",
  updatedAt: "2098-12-30T10:00:00.000Z",
});

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

function makeAppointment() {
  return Appointment.rehydrate(baseAppointment.toJSON());
}

function makeThursdaySchedule(startTime: string, endTime: string) {
  return ProviderSchedule.create({
    providerId: "provider-1",
    dayOfWeek: 4,
    startTime,
    endTime,
  });
}

describe("UpdateAppointmentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      mockAppointmentRepo.withSerializableTransaction as ReturnType<
        typeof vi.fn
      >
    ).mockImplementation(async (operation) => operation(mockAppointmentRepo));
  });

  it("persists schedule and metadata updates through the transaction path", async () => {
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(makeAppointment());
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeThursdaySchedule("09:00", "17:00")]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      id: "type-new",
      isActive: true,
      defaultDurationMinutes: 45,
    });
    (prisma.location.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "location-new",
      isActive: true,
    });
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 10,
    });

    const useCase = new UpdateAppointmentUseCase(
      mockAppointmentRepo,
      mockScheduleRepo,
      mockBlockRepo,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute("appointment-1", {
      appointmentTypeId: "type-new",
      locationId: "location-new",
      scheduledStart: "2099-01-01T11:00:00.000Z",
      reason: "Updated reason",
      notes: "Updated notes",
    });

    expect(result.appointmentTypeId).toBe("type-new");
    expect(result.durationMinutes).toBe(45);
    expect(result.locationId).toBe("location-new");
    expect(result.reason).toBe("Updated reason");
    expect(result.notes).toBe("Updated notes");
    expect(result.scheduledStart.toISOString()).toBe(
      "2099-01-01T11:00:00.000Z",
    );
    expect(result.scheduledEnd.toISOString()).toBe("2099-01-01T11:45:00.000Z");

    expect(
      mockAppointmentRepo.withSerializableTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(
      mockAppointmentRepo.findOverlappingForProvider,
    ).toHaveBeenCalledTimes(1);

    const [providerId, windowStart, windowEnd] = (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    expect(providerId).toBe("provider-1");
    expect((windowStart as Date).toISOString()).toBe(
      "2099-01-01T10:50:00.000Z",
    );
    expect((windowEnd as Date).toISOString()).toBe("2099-01-01T11:55:00.000Z");

    const savedAppointment = (
      mockAppointmentRepo.save as ReturnType<typeof vi.fn>
    ).mock.calls[0][0] as Appointment;
    expect(savedAppointment.toJSON()).toEqual(result.toJSON());

    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AppointmentUpdated",
        payload: expect.objectContaining({
          appointmentId: "appointment-1",
          appointmentTypeId: "type-new",
          durationMinutes: 45,
          locationId: "location-new",
          reason: "Updated reason",
          notes: "Updated notes",
        }),
      }),
    );
  });

  it("accepts rescheduling into a later split-shift window", async () => {
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(makeAppointment());
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      makeThursdaySchedule("09:00", "12:00"),
      makeThursdaySchedule("14:00", "17:00"),
    ]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
    });

    const useCase = new UpdateAppointmentUseCase(
      mockAppointmentRepo,
      mockScheduleRepo,
      mockBlockRepo,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute("appointment-1", {
      scheduledStart: "2099-01-01T14:30:00.000Z",
    });

    expect(result.scheduledStart.toISOString()).toBe(
      "2099-01-01T14:30:00.000Z",
    );
    expect(mockAppointmentRepo.save).toHaveBeenCalledTimes(1);
  });

  it("rejects blocked schedule changes before the transaction runs", async () => {
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(makeAppointment());
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeThursdaySchedule("09:00", "17:00")]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      ScheduleBlock.create({
        providerId: "provider-1",
        startDateTime: "2099-01-01T11:00:00.000Z",
        endDateTime: "2099-01-01T11:45:00.000Z",
        reason: "Protected time",
      }),
    ]);

    const useCase = new UpdateAppointmentUseCase(
      mockAppointmentRepo,
      mockScheduleRepo,
      mockBlockRepo,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute("appointment-1", {
        scheduledStart: "2099-01-01T11:00:00.000Z",
      }),
    ).rejects.toThrow(
      "This time slot is blocked. Please choose a different time.",
    );

    expect(
      mockAppointmentRepo.withSerializableTransaction,
    ).not.toHaveBeenCalled();
    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
  });

  it("rejects conflicting schedule changes", async () => {
    (
      mockAppointmentRepo.findById as ReturnType<typeof vi.fn>
    ).mockResolvedValue(makeAppointment());
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([makeThursdaySchedule("09:00", "17:00")]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      mockAppointmentRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      Appointment.rehydrate({
        id: "appointment-2",
        patientId: "patient-2",
        providerId: "provider-1",
        appointmentTypeId: "type-old",
        durationMinutes: 30,
        locationId: "location-old",
        scheduledStart: "2099-01-01T11:15:00.000Z",
        scheduledEnd: "2099-01-01T11:45:00.000Z",
        status: "SCHEDULED",
        reason: null,
        notes: null,
        createdAt: "2098-12-30T10:00:00.000Z",
        updatedAt: "2098-12-30T10:00:00.000Z",
      }),
    ]);
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      appointmentBufferMinutes: 0,
    });

    const useCase = new UpdateAppointmentUseCase(
      mockAppointmentRepo,
      mockScheduleRepo,
      mockBlockRepo,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute("appointment-1", {
        scheduledStart: "2099-01-01T11:00:00.000Z",
      }),
    ).rejects.toThrow(ConflictError);

    expect(
      mockAppointmentRepo.withSerializableTransaction,
    ).toHaveBeenCalledTimes(1);
    expect(mockAppointmentRepo.save).not.toHaveBeenCalled();
  });
});
