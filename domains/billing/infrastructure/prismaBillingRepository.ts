import { Invoice } from "../domain/invoiceEntity.js";
import { InvoiceLineItem } from "../domain/invoiceLineItemEntity.js";
import { Payment } from "../domain/paymentEntity.js";
import {
  IBillingRepository,
  PaginationParams,
  PaginatedResult,
} from "../domain/billingRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { Decimal } from "@prisma/client/runtime/library";

function toNumber(value: number | Decimal): number {
  return typeof value === "number" ? value : Number(value.toString());
}

export class PrismaBillingRepository implements IBillingRepository {
  constructor() {}

  async findInvoiceById(id: string): Promise<Invoice | null> {
    const record = await prisma.invoice.findUnique({
      where: { id },
      include: { lineItems: true, payments: true },
    });

    if (!record) return null;

    return Invoice.rehydrate({
      id: record.id,
      patientId: record.patientId,
      encounterId: record.encounterId,
      status: record.status,
      subtotal: toNumber(record.subtotal),
      tax: toNumber(record.tax),
      total: toNumber(record.total),
      dueDate: record.dueDate,
      paidAt: record.paidAt,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findInvoicesByPatientId(
    patientId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Invoice>> {
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 20;
    const skip = (page - 1) * limit;

    const [records, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { patientId },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where: { patientId } }),
    ]);

    const data = records.map((record) =>
      Invoice.rehydrate({
        id: record.id,
        patientId: record.patientId,
        encounterId: record.encounterId,
        status: record.status,
        subtotal: toNumber(record.subtotal),
        tax: toNumber(record.tax),
        total: toNumber(record.total),
        dueDate: record.dueDate,
        paidAt: record.paidAt,
        notes: record.notes,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt,
      }),
    );

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findInvoicesByEncounterId(
    encounterId: string,
  ): Promise<Invoice | null> {
    const record = await prisma.invoice.findFirst({
      where: { encounterId },
    });

    if (!record) return null;

    return Invoice.rehydrate({
      id: record.id,
      patientId: record.patientId,
      encounterId: record.encounterId,
      status: record.status,
      subtotal: toNumber(record.subtotal),
      tax: toNumber(record.tax),
      total: toNumber(record.total),
      dueDate: record.dueDate,
      paidAt: record.paidAt,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async saveInvoice(invoice: Invoice): Promise<void> {
    await prisma.invoice.upsert({
      where: { id: invoice.id },
      update: {
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        notes: invoice.notes,
      },
      create: {
        id: invoice.id,
        patientId: invoice.patientId,
        encounterId: invoice.encounterId,
        status: invoice.status,
        subtotal: invoice.subtotal,
        tax: invoice.tax,
        total: invoice.total,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        notes: invoice.notes,
      },
    });
  }

  async deleteInvoice(id: string): Promise<void> {
    await prisma.invoice.delete({
      where: { id },
    });
  }

  async findLineItemsByInvoiceId(
    invoiceId: string,
  ): Promise<InvoiceLineItem[]> {
    const records = await prisma.invoiceLineItem.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "asc" },
    });

    return records.map((record) =>
      InvoiceLineItem.rehydrate({
        id: record.id,
        invoiceId: record.invoiceId,
        description: record.description,
        cptCode: record.cptCode,
        quantity: record.quantity,
        unitPrice: toNumber(record.unitPrice),
        total: toNumber(record.total),
        createdAt: record.createdAt,
      }),
    );
  }

  async saveLineItem(lineItem: InvoiceLineItem): Promise<void> {
    await prisma.invoiceLineItem.upsert({
      where: { id: lineItem.id },
      update: {
        description: lineItem.description,
        cptCode: lineItem.cptCode,
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        total: lineItem.total,
      },
      create: {
        id: lineItem.id,
        invoiceId: lineItem.invoiceId,
        description: lineItem.description,
        cptCode: lineItem.cptCode,
        quantity: lineItem.quantity,
        unitPrice: lineItem.unitPrice,
        total: lineItem.total,
      },
    });
  }

  async deleteLineItem(id: string): Promise<void> {
    await prisma.invoiceLineItem.delete({
      where: { id },
    });
  }

  async findPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]> {
    const records = await prisma.payment.findMany({
      where: { invoiceId },
      orderBy: { createdAt: "desc" },
    });

    return records.map((record) =>
      Payment.rehydrate({
        id: record.id,
        invoiceId: record.invoiceId,
        amount: toNumber(record.amount),
        method: record.method,
        reference: record.reference,
        status: record.status,
        processedAt: record.processedAt,
        createdAt: record.createdAt,
      }),
    );
  }

  async findPaymentById(id: string): Promise<Payment | null> {
    const record = await prisma.payment.findUnique({
      where: { id },
    });

    if (!record) return null;

    return Payment.rehydrate({
      id: record.id,
      invoiceId: record.invoiceId,
      amount: toNumber(record.amount),
      method: record.method,
      reference: record.reference,
      status: record.status,
      processedAt: record.processedAt,
      createdAt: record.createdAt,
    });
  }

  async savePayment(payment: Payment): Promise<void> {
    await prisma.payment.upsert({
      where: { id: payment.id },
      update: {
        status: payment.status,
        processedAt: payment.processedAt,
      },
      create: {
        id: payment.id,
        invoiceId: payment.invoiceId,
        amount: payment.amount,
        method: payment.method,
        reference: payment.reference,
        status: payment.status,
        processedAt: payment.processedAt,
      },
    });
  }

  async executeInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}
