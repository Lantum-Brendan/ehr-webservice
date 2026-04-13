import { beforeEach, describe, expect, it, vi } from "vitest";
import { type IAppointmentRepository } from "../domain/appointmentRepository";
import { type IEventBus } from "@shared/event-bus/event-bus.interface";
import { type Logger } from "@shared/logger/index";
import { ForbiddenError } from "@core/errors/appError";

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    clinicSettings: {
      findFirst: vi.fn(),
    },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { Appointment } = await import("../domain/appointmentEntity.js");
const { CancelAppointmentUseCase } =
  await import("./cancelAppointmentUseCase.js");

function makeAppointment() {
  return Appointment.rehydrate({
    id: "appointment-1",
    patientId: "patient-1",
    providerId: "provider-1",
    appointmentTypeId: "type-1",
    durationMinutes: 30,
    locationId: "location-1",
    scheduledStart: "2099-01-01T10:00:00.000Z",
    scheduledEnd: "2099-01-01T10:30:00.000Z",
    status: "SCHEDULED",
    reason: "Initial reason",
    notes: null,
    createdAt: "2098-12-30T10:00:00.000Z",
    updatedAt: "2098-12-30T10:00:00.000Z",
  });
}

const mockRepo: Partial<IAppointmentRepository> = {
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

describe("CancelAppointmentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores patient cancellations with the patient-specific status", async () => {
    const appointment = makeAppointment();
    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointment,
    );
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      cancellationCutoffHours: 24,
    });

    const useCase = new CancelAppointmentUseCase(
      mockRepo as IAppointmentRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    const result = await useCase.execute("appointment-1", {
      cancelledBy: "patient-1",
      reason: "Not available",
      isPatientCancel: true,
    });

    expect(result.status).toBe("CANCELLED_BY_PATIENT");
    expect(result.cancelledBy).toBe("patient-1");
    expect(result.cancelledReason).toBe("Not available");
    expect(mockRepo.save).toHaveBeenCalledWith(appointment);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "AppointmentCancelled",
        payload: expect.objectContaining({
          appointmentId: "appointment-1",
          cancelledByPatient: true,
          status: "CANCELLED_BY_PATIENT",
        }),
      }),
    );
  });

  it("enforces the patient cancellation cutoff", async () => {
    const appointment = makeAppointment();
    appointment.updateDetails({
      scheduledStart: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    });

    (mockRepo.findById as ReturnType<typeof vi.fn>).mockResolvedValue(
      appointment,
    );
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({
      cancellationCutoffHours: 24,
    });

    const useCase = new CancelAppointmentUseCase(
      mockRepo as IAppointmentRepository,
      mockEventBus as IEventBus,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute("appointment-1", {
        cancelledBy: "patient-1",
        reason: "Late cancellation",
        isPatientCancel: true,
      }),
    ).rejects.toThrow(ForbiddenError);

    expect(mockRepo.save).not.toHaveBeenCalled();
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });
});
