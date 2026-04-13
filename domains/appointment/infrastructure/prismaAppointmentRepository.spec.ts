import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaAppointmentMock = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

const transactionAppointmentMock = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

const prismaTransactionMock = vi.fn();

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    appointment: prismaAppointmentMock,
    $transaction: prismaTransactionMock,
  },
}));

const { Appointment } = await import("../domain/appointmentEntity.js");
const { PrismaAppointmentRepository } =
  await import("./prismaAppointmentRepository.js");

describe("PrismaAppointmentRepository", () => {
  let repo: InstanceType<typeof PrismaAppointmentRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaAppointmentRepository();
  });

  it("persists updated appointment type and duration fields", async () => {
    const appointment = Appointment.rehydrate({
      id: "appointment-1",
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-new",
      durationMinutes: 45,
      locationId: "location-1",
      scheduledStart: "2099-01-01T10:00:00.000Z",
      scheduledEnd: "2099-01-01T10:45:00.000Z",
      status: "SCHEDULED",
      reason: "Updated reason",
      notes: "Updated notes",
      createdAt: "2098-12-30T09:00:00.000Z",
      updatedAt: "2098-12-30T09:05:00.000Z",
      cancelledAt: null,
      cancelledBy: null,
      cancelledReason: null,
    });

    await repo.save(appointment);

    expect(prismaAppointmentMock.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          appointmentTypeId: "type-new",
          durationMinutes: 45,
          updatedAt: "2098-12-30T09:05:00.000Z",
        }),
      }),
    );
  });

  it("runs operations inside a serializable transaction", async () => {
    prismaTransactionMock.mockImplementation(async (operation, options) => {
      expect(options).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return operation({
        appointment: transactionAppointmentMock,
      });
    });

    transactionAppointmentMock.findUnique.mockResolvedValue({
      id: "appointment-1",
      patientId: "patient-1",
      providerId: "provider-1",
      appointmentTypeId: "type-1",
      durationMinutes: 30,
      locationId: null,
      scheduledStart: new Date("2099-01-01T10:00:00.000Z"),
      scheduledEnd: new Date("2099-01-01T10:30:00.000Z"),
      status: "SCHEDULED",
      reason: null,
      notes: null,
      createdAt: new Date("2098-12-30T09:00:00.000Z"),
      updatedAt: new Date("2098-12-30T09:00:00.000Z"),
      cancelledAt: null,
      cancelledBy: null,
      cancelledReason: null,
    });

    const result = await repo.withSerializableTransaction((transactionRepo) =>
      transactionRepo.findById("appointment-1"),
    );

    expect(prismaTransactionMock).toHaveBeenCalledTimes(1);
    expect(transactionAppointmentMock.findUnique).toHaveBeenCalledWith({
      where: { id: "appointment-1" },
    });
    expect(result?.id).toBe("appointment-1");
  });
});
