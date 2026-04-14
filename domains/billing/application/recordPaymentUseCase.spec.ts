import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Logger } from "@shared/logger/index.js";

import type { IBillingRepository } from "../domain/billingRepository.js";
import { Invoice, InvoiceStatus } from "../domain/invoiceEntity.js";
import { Payment, PaymentStatus } from "../domain/paymentEntity.js";
import { FinancialEventType } from "../infrastructure/financialAuditService.js";

vi.mock("uuid", () => ({
  v4: vi.fn(() => "payment-uuid-1"),
}));

const { RecordPaymentUseCase } = await import("./recordPaymentUseCase.js");

const invoice = Invoice.rehydrate({
  id: "invoice-1",
  patientId: "patient-1",
  encounterId: "encounter-1",
  jurisdiction: "NY",
  status: InvoiceStatus.SENT,
  subtotal: 92,
  tax: 8,
  total: 100,
  dueDate: null,
  paidAt: null,
  notes: null,
  createdAt: "2099-01-01T00:00:00.000Z",
  updatedAt: "2099-01-01T00:00:00.000Z",
});

const existingPayments = [
  Payment.rehydrate({
    id: "payment-completed-1",
    invoiceId: "invoice-1",
    amount: 40,
    method: "CARD",
    reference: null,
    status: PaymentStatus.COMPLETED,
    processedAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2099-01-01T00:00:00.000Z",
  }),
  Payment.rehydrate({
    id: "payment-failed-1",
    invoiceId: "invoice-1",
    amount: 500,
    method: "CARD",
    reference: null,
    status: PaymentStatus.FAILED,
    processedAt: "2099-01-01T00:00:00.000Z",
    createdAt: "2099-01-01T00:00:00.000Z",
  }),
];

let savedPayment: Payment | undefined;

const mockRepo: Partial<IBillingRepository> = {
  findInvoiceById: vi.fn(async () => invoice),
  findInvoicesByPatientId: vi.fn(),
  findInvoicesByEncounterId: vi.fn(),
  findEncounterPatientId: vi.fn(),
  saveInvoice: vi.fn(),
  deleteInvoice: vi.fn(),
  findLineItemsByInvoiceId: vi.fn(),
  saveLineItem: vi.fn(),
  deleteLineItem: vi.fn(),
  findPaymentsByInvoiceId: vi.fn(async () => existingPayments),
  findPaymentById: vi.fn(),
  savePayment: vi.fn(async (payment: Payment) => {
    savedPayment = payment;
  }),
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

describe("RecordPaymentUseCase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    savedPayment = undefined;
    invoice.setStatus(InvoiceStatus.SENT);
  });

  it("ignores failed payments when validating and marks the invoice paid", async () => {
    const useCase = new RecordPaymentUseCase(
      mockRepo as IBillingRepository,
      mockAuditService as any,
      mockLogger as Logger,
    );

    const payment = await useCase.execute({
      invoiceId: "invoice-1",
      amount: 60,
      method: "CARD",
      reference: "auth-1",
    });

    expect(mockRepo.withSerializableTransaction).toHaveBeenCalledTimes(1);
    expect(savedPayment?.status).toBe(PaymentStatus.COMPLETED);
    expect(payment.id).toBe("payment-uuid-1");
    expect(invoice.status).toBe(InvoiceStatus.PAID);
    expect(mockRepo.saveInvoice).toHaveBeenCalledWith(invoice);
    expect(mockAuditService.log).toHaveBeenCalledWith(
      FinancialEventType.PAYMENT_RECORDED,
      expect.objectContaining({
        paymentId: "payment-uuid-1",
        invoiceId: "invoice-1",
        totalPaid: 100,
      }),
    );
  });
});
