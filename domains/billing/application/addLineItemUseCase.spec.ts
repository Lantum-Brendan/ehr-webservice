import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@shared/logger/index.js";

import type { IBillingRepository } from "../domain/billingRepository.js";
import { Invoice, InvoiceStatus } from "../domain/invoiceEntity.js";
import { type InvoiceLineItem } from "../domain/invoiceLineItemEntity.js";
import { FinancialEventType } from "../infrastructure/financialAuditService.js";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "line-item-uuid-1"),
}));

const { AddLineItemUseCase } = await import("./addLineItemUseCase.js");

const storedLineItems: InvoiceLineItem[] = [];
const invoice = Invoice.rehydrate({
  id: "invoice-1",
  patientId: "patient-1",
  encounterId: "encounter-1",
  jurisdiction: "NY",
  status: InvoiceStatus.DRAFT,
  subtotal: 0,
  tax: 0,
  total: 0,
  dueDate: null,
  paidAt: null,
  notes: null,
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z",
});

const mockRepo: Partial<IBillingRepository> = {
  findInvoiceById: vi.fn(async () => invoice),
  findInvoicesByPatientId: vi.fn(),
  findInvoicesByEncounterId: vi.fn(),
  findEncounterPatientId: vi.fn(),
  saveInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  findLineItemsByInvoiceId: vi.fn(async () => [...storedLineItems]),
  saveLineItem: vi.fn(async (lineItem: InvoiceLineItem) => {
    storedLineItems.push(lineItem);
  }),
  deleteLineItem: vi.fn(),
  findPaymentsByInvoiceId: vi.fn(),
  findPaymentById: vi.fn(),
  savePayment: vi.fn(),
  withSerializableTransaction: vi.fn(async (operation) =>
    operation(mockRepo as IBillingRepository),
  ),
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

describe("AddLineItemUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    storedLineItems.length = 0;
    invoice.setStatus(InvoiceStatus.DRAFT);
    invoice.calculateTotals([]);
  });

  it("recalculates tax and total inside the transaction using invoice jurisdiction", async () => {
    const useCase = new AddLineItemUseCase(
      mockRepo as IBillingRepository,
      mockAuditService as any,
      mockLogger as Logger,
    );

    const lineItem = await useCase.execute({
      invoiceId: "invoice-1",
      description: "Consultation",
      quantity: 2,
      unitPrice: 50,
    });

    expect(lineItem.id).toBe("line-item-uuid-1");
    expect(mockRepo.withSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(invoice.subtotal).toBe(100);
    expect(invoice.tax).toBe(8);
    expect(invoice.total).toBe(108);
    expect(mockRepo.saveInvoice).toHaveBeenCalledWith(invoice);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      FinancialEventType.TAX_CALCULATED,
      expect.objectContaining({
        invoiceId: "invoice-1",
        jurisdiction: "NY",
        subtotal: 100,
        tax: 8,
        total: 108,
      }),
    );
  });
});
