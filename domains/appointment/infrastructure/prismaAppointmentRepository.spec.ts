import { beforeEach, describe, expect, it, vi } from "vitest";

const prismaAppointmentMock = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    appointment: prismaAppointmentMock,
    $transaction: vi.fn(),
  },
}));

const { Appointment } = await import("../domain/appointmentEntity.js");
const { PrismaAppointmentRepository } = await import(
  "./prismaAppointmentRepository.js"
);

describe("PrismaAppointmentRepository", () => {
  let repo: PrismaAppointmentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAppointmentRepository();
  });

  it("persists updated appointment type, duration, and Date fields as Date objects", async () => {
    const appointment = Appointment.rehydrate({
      id: "appointment-1",
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-old",
      durationMinutes: 30,
      locationId: "location-1",
      scheduledStart: "2099-01-01T10:00:00.000Z",
      scheduledEnd: "2099-01-01T10:30:00.000Z",
      status: "SCHEDULED",
      reason: "Initial reason",
      notes: "Initial notes",
      createdAt: "2098-12-30T09:00:00.000Z",
      updatedAt: "2098-12-30T09:00:00.000Z",
      cancelledAt: null,
      cancelledBy: null,
      cancelledReason: null,
    });

    appointment.updateDetails({
      appointmentTypeId: "type-new",
      durationMinutes: 45,
      scheduledStart: "2099-01-01T11:00:00.000Z",
      reason: "Updated reason",
      notes: "Updated notes",
      now: new Date("2098-12-31T09:00:00.000Z"),
    });

    await repo.save(appointment);

    expect(prismaAppointmentMock.upsert).toHaveBeenCalledWith({
      where: { id: "appointment-1" },
      update: expect.objectContaining({
        appointmentTypeId: "type-new",
        durationMinutes: 45,
        scheduledStart: new Date("2099-01-01T11:00:00.000Z"),
        scheduledEnd: new Date("2099-01-01T11:45:00.000Z"),
        updatedAt: new Date("2098-12-31T09:00:00.000Z"),
      }),
      create: expect.objectContaining({
        appointmentTypeId: "type-new",
        durationMinutes: 45,
        scheduledStart: new Date("2099-01-01T11:00:00.000Z"),
        scheduledEnd: new Date("2099-01-01T11:45:00.000Z"),
        createdAt: new Date("2098-12-30T09:00:00.000Z"),
        updatedAt: new Date("2098-12-31T09:00:00.000Z"),
      }),
    });
  });
});
