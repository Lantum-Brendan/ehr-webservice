import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@prisma/client";

const prismaInvoiceMock = {
  findUnique: vi.fn(),
  findMany: vi.fn(),
  findFirst: vi.fn(),
  count: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

const prismaLineItemMock = {
  findMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

const prismaPaymentMock = {
  findMany: vi.fn(),
  findUnique: vi.fn(),
  upsert: vi.fn(),
};

const prismaEncounterMock = {
  findUnique: vi.fn(),
};

const transactionEncounterMock = {
  findUnique: vi.fn(),
};

const prismaTransactionMock = vi.fn();
const loggerWarnMock = vi.fn();

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    invoice: prismaInvoiceMock,
    invoiceLineItem: prismaLineItemMock,
    payment: prismaPaymentMock,
    encounter: prismaEncounterMock,
    $transaction: prismaTransactionMock,
  },
}));

vi.mock("@shared/logger/index.js", () => ({
  logger: {
    info: vi.fn(),
    warn: loggerWarnMock,
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(function child() {
      return this;
    }),
  },
}));

const { PrismaBillingRepository } = await import("./prismaBillingRepository.js");

describe("PrismaBillingRepository", () => {
  let repo: InstanceType<typeof PrismaBillingRepository>;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaBillingRepository();
  });

  it("loads encounter ownership from Prisma", async () => {
    prismaEncounterMock.findUnique.mockResolvedValue({ patientId: "patient-1" });

    const patientId = await repo.findEncounterPatientId("encounter-1");

    expect(prismaEncounterMock.findUnique).toHaveBeenCalledWith({
      where: { id: "encounter-1" },
      select: { patientId: true },
    });
    expect(patientId).toBe("patient-1");
  });

  it("runs operations inside a serializable transaction", async () => {
    prismaTransactionMock.mockImplementation(async (operation, options) => {
      expect(options).toEqual({
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      return operation({
        invoice: prismaInvoiceMock,
        invoiceLineItem: prismaLineItemMock,
        payment: prismaPaymentMock,
        encounter: transactionEncounterMock,
      });
    });

    transactionEncounterMock.findUnique.mockResolvedValue({
      patientId: "patient-1",
    });

    const patientId = await repo.withSerializableTransaction(
      (transactionRepo) =>
        transactionRepo.findEncounterPatientId("encounter-1"),
    );

    expect(prismaTransactionMock).toHaveBeenCalledTimes(1);
    expect(transactionEncounterMock.findUnique).toHaveBeenCalledWith({
      where: { id: "encounter-1" },
      select: { patientId: true },
    });
    expect(patientId).toBe("patient-1");
  });

  it("retries transaction conflicts and logs the retry", async () => {
    const conflictError = new Prisma.PrismaClientKnownRequestError(
      "write conflict",
      {
        code: "P2034",
        clientVersion: "test",
      },
    );

    prismaTransactionMock
      .mockRejectedValueOnce(conflictError)
      .mockImplementationOnce(async (operation) =>
        operation({
          invoice: prismaInvoiceMock,
          invoiceLineItem: prismaLineItemMock,
          payment: prismaPaymentMock,
          encounter: transactionEncounterMock,
        }),
      );

    transactionEncounterMock.findUnique.mockResolvedValue({
      patientId: "patient-1",
    });

    const patientId = await repo.withSerializableTransaction(
      (transactionRepo) =>
        transactionRepo.findEncounterPatientId("encounter-1"),
    );

    expect(prismaTransactionMock).toHaveBeenCalledTimes(2);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      {
        attempt: 1,
        maxAttempts: 3,
      },
      "Retrying billing serializable transaction after contention",
    );
    expect(patientId).toBe("patient-1");
  });
});
