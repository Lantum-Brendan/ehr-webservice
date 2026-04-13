import { beforeEach, describe, expect, it, vi } from "vitest";

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
    clinicSettings: {
      findFirst: vi.fn(),
    },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { GetAvailableSlotsUseCase } =
  await import("./getAvailableSlotsUseCase.js");

const mockScheduleRepo: IProviderScheduleRepository = {
  findByProviderId: vi.fn(),
  findByProviderAndDay: vi.fn(),
};

const mockBlockRepo: IScheduleBlockRepository = {
  findByProviderId: vi.fn(),
  findByProviderAndDateRange: vi.fn(),
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

function makeLocalDate(hours = 0, minutes = 0) {
  return new Date(2099, 5, 15, hours, minutes, 0, 0);
}

function formatLocalTime(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(
    date.getMinutes(),
  ).padStart(2, "0")}`;
}

describe("GetAvailableSlotsUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (
      prisma.clinicSettings.findFirst as ReturnType<typeof vi.fn>
    ).mockResolvedValue({ appointmentBufferMinutes: 0 });
  });

  it("returns slots across multiple working windows", async () => {
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      ProviderSchedule.create({
        providerId: "provider-1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "10:00",
      }),
      ProviderSchedule.create({
        providerId: "provider-1",
        dayOfWeek: 1,
        startTime: "14:00",
        endTime: "15:00",
      }),
    ]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);
    (
      mockAppointmentRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([]);

    const useCase = new GetAvailableSlotsUseCase(
      mockScheduleRepo,
      mockBlockRepo,
      mockAppointmentRepo,
    );

    const slots = await useCase.execute(
      "provider-1",
      makeLocalDate(),
      30,
    );

    expect(slots.map((slot) => formatLocalTime(slot.start))).toEqual([
      "09:00",
      "09:30",
      "14:00",
      "14:30",
    ]);
  });

  it("removes slots covered by blocks and active appointments", async () => {
    (
      mockScheduleRepo.findByProviderAndDay as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      ProviderSchedule.create({
        providerId: "provider-1",
        dayOfWeek: 1,
        startTime: "09:00",
        endTime: "12:00",
      }),
    ]);
    (
      mockBlockRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      ScheduleBlock.create({
        providerId: "provider-1",
        startDateTime: makeLocalDate(9, 30),
        endDateTime: makeLocalDate(10, 0),
        reason: "Team meeting",
      }),
    ]);
    (
      mockAppointmentRepo.findByProviderAndDateRange as ReturnType<typeof vi.fn>
    ).mockResolvedValue([
      Appointment.rehydrate({
        id: "appointment-1",
        patientId: "patient-1",
        providerId: "provider-1",
        appointmentTypeId: "type-1",
        durationMinutes: 30,
        locationId: null,
        scheduledStart: makeLocalDate(10, 30),
        scheduledEnd: makeLocalDate(11, 0),
        status: "SCHEDULED",
        reason: null,
        notes: null,
        createdAt: "2099-06-01T10:00:00.000Z",
        updatedAt: "2099-06-01T10:00:00.000Z",
      }),
    ]);

    const useCase = new GetAvailableSlotsUseCase(
      mockScheduleRepo,
      mockBlockRepo,
      mockAppointmentRepo,
    );

    const slots = await useCase.execute(
      "provider-1",
      makeLocalDate(),
      30,
    );

    expect(slots.map((slot) => formatLocalTime(slot.start))).toEqual([
      "09:00",
      "10:00",
      "11:00",
      "11:30",
    ]);
  });
});
