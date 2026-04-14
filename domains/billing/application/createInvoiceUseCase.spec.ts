import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  BadRequestError,
  NotFoundError,
} from "@core/errors/appError.js";
import type { Logger } from "@shared/logger/index.js";

import type { IBillingRepository } from "../domain/billingRepository.js";
import { FinancialEventType } from "../infrastructure/financialAuditService.js";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "invoice-uuid-1"),
}));

const { CreateInvoiceUseCase } = await import("./createInvoiceUseCase.js");

const mockRepo: Partial<IBillingRepository> = {
  findInvoiceById: vi.fn(),
  findInvoicesByPatientId: vi.fn(),
  findInvoicesByEncounterId: vi.fn(),
  findEncounterPatientId: vi.fn(),
  saveInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  findLineItemsByInvoiceId: vi.fn(),
  saveLineItem: vi.fn(),
  deleteLineItem: vi.fn(),
  findPaymentsByInvoiceId: vi.fn(),
  findPaymentById: vi.fn(),
  savePayment: vi.fn(),
  withSerializableTransaction: vi.fn(),
};

const mockAuditService = {
  log: vi.fn(),
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

describe("CreateInvoiceUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects missing encounters", async () => {
    (
      mockRepo.findEncounterPatientId as ReturnType<typeof vi.fn>
    ).mockResolvedValue(null);

    const useCase = new CreateInvoiceUseCase(
      mockRepo as IBillingRepository,
      mockAuditService as any,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        encounterId: "encounter-missing",
      }),
    ).rejects.toThrow(NotFoundError);

    expect(mockRepo.saveInvoice).not.toHaveBeenCalled();
  });

  it("rejects encounters that belong to a different patient", async () => {
    (
      mockRepo.findEncounterPatientId as ReturnType<typeof vi.fn>
    ).mockResolvedValue("patient-2");

    const useCase = new CreateInvoiceUseCase(
      mockRepo as IBillingRepository,
      mockAuditService as any,
      mockLogger as Logger,
    );

    await expect(
      useCase.execute({
        patientId: "patient-1",
        encounterId: "encounter-1",
      }),
    ).rejects.toThrow(BadRequestError);

    expect(mockRepo.saveInvoice).not.toHaveBeenCalled();
  });

  it("persists jurisdiction when the encounter belongs to the patient", async () => {
    (
      mockRepo.findEncounterPatientId as ReturnType<typeof vi.fn>
    ).mockResolvedValue("patient-1");

    const useCase = new CreateInvoiceUseCase(
      mockRepo as IBillingRepository,
      mockAuditService as any,
      mockLogger as Logger,
    );

    const invoice = await useCase.execute({
      patientId: "patient-1",
      encounterId: "encounter-1",
      jurisdiction: "NY",
      notes: "Follow-up visit",
    });

    expect(invoice.jurisdiction).toBe("NY");
    expect(mockRepo.saveInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        patientId: "patient-1",
        encounterId: "encounter-1",
        jurisdiction: "NY",
      }),
    );
    expect(mockAuditService.log).toHaveBeenCalledWith(
      FinancialEventType.INVOICE_CREATED,
      expect.objectContaining({
        invoiceId: "invoice-uuid-1",
        patientId: "patient-1",
        encounterId: "encounter-1",
        jurisdiction: "NY",
      }),
    );
  });
});
