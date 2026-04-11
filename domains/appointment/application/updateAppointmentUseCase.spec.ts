import { beforeEach, describe, expect, it, vi } from "vitest";
import { type IAppointmentRepository } from "../domain/appointmentRepository";
import { type IEventBus } from "@shared/event-bus/event-bus.interface";
import { type Logger } from "@shared/logger/index";
import { ConflictError } from "@core/errors/appError";

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
const { Appointment } = await import("../domain/appointmentEntity.js");
const { UpdateAppointmentUseCase } = await import("./updateAppointmentUseCase.js");
const { resetAppointmentClinicSettingsCache } = await import(
  "../infrastructure/appointmentClinicSettings.js"
);

const mockAppointment = Appointment.rehydrate({
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

const mockRepo: Partial<IAppointmentRepository> = {
  findById: vi.fn(),
  findByPatientId: vi.fn(),
  findByProviderId: vi.fn(),
  findByDateRange: vi.fn(),
  findByProviderAndDateRange: vi.fn(),
  findOverlappingForProvider: vi.fn(),
  withSerializableTransaction: vi.fn(async (operation) =>
    operation(mockRepo as IAppointmentRepository),
  ),
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

describe("UpdateAppointmentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetAppointmentClinicSettingsCache();
    Object.assign(mockAppointment, Appointment.rehydrate({
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
    }));
  });

  it("persists schedule and metadata updates with an overlap-aware query", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockAppointment,
    );
    (mockRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>)
      .mockResolvedValue([]);
    (prisma.appointmentType.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValue({
        id: "type-new",
        isActive: true,
        defaultDurationMinutes: 45,
      });
    (prisma.location.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "location-new",
      isActive: true,
    });
    (prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValue({
        appointmentBufferMinutes: 10,
      });

    const useCase = new UpdateAppointmentUseCase(
      mockRepo as IAppointmentRepository,
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
    expect(result.scheduledEnd.toISOString()).toBe(
      "2099-01-01T11:45:00.000Z",
    );

    expect(mockRepo.findOverlappingForProvider).toHaveBeenCalledTimes(1);
    const [providerId, windowStart, windowEnd] =
      (mockRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>)
        .mock.calls[0];
    expect(providerId).toBe("provider-1");
    expect((windowStart as Date).toISOString()).toBe(
      "2099-01-01T10:50:00.000Z",
    );
    expect((windowEnd as Date).toISOString()).toBe(
      "2099-01-01T11:55:00.000Z",
    );

    expect(mockRepo.save).toHaveBeenCalledWith(mockAppointment);
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

  it("rejects conflicting schedule changes", async () => {
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockAppointment,
    );
    (mockRepo.findOverlappingForProvider as ReturnType<typeof vi.fn>)
      .mockResolvedValue([
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
    (prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>)
      .mockResolvedValue({
        appointmentBufferMinutes: 0,
      });

    const useCase = new UpdateAppointmentUseCase(
      mockRepo as IAppointmentRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute("appointment-1", {
        scheduledStart: "2099-01-01T11:00:00.000Z",
      }),
    ).rejects.toThrow(ConflictError);

    expect(mockRepo.save).not.toHaveBeenCalled();
  });
});
