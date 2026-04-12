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
const { PrismaAppointmentRepository } =
  await import("./prismaAppointmentRepository.js");

describe("PrismaAppointmentRepository", () => {
  let repo: PrismaAppointmentRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAppointmentRepository();
  });

  it("persists appointment data", async () => {
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

    await repo.save(appointment);

    expect(prismaAppointmentMock.upsert).toHaveBeenCalledTimes(1);
  });
});
