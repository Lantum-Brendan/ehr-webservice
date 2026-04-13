import { Invoice } from "./invoiceEntity.js";
import { InvoiceLineItem } from "./invoiceLineItemEntity.js";
import { Payment } from "./paymentEntity.js";

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IBillingRepository {
  // Invoice operations
  findInvoiceById(id: string): Promise<Invoice | null>;
  findInvoicesByPatientId(
    patientId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Invoice>>;
  findInvoicesByEncounterId(encounterId: string): Promise<Invoice | null>;
  saveInvoice(invoice: Invoice): Promise<void>;
  deleteInvoice(id: string): Promise<void>;

  // Line item operations
  findLineItemsByInvoiceId(invoiceId: string): Promise<InvoiceLineItem[]>;
  saveLineItem(lineItem: InvoiceLineItem): Promise<void>;
  deleteLineItem(id: string): Promise<void>;

  // Payment operations
  findPaymentsByInvoiceId(invoiceId: string): Promise<Payment[]>;
  findPaymentById(id: string): Promise<Payment | null>;
  savePayment(payment: Payment): Promise<void>;

  // Transaction support
  executeInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
