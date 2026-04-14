import { type Logger } from "@shared/logger/index.js";

export enum FinancialEventType {
  INVOICE_CREATED = "INVOICE_CREATED",
  INVOICE_MODIFIED = "INVOICE_MODIFIED",
  INVOICE_SENT = "INVOICE_SENT",
  INVOICE_PAID = "INVOICE_PAID",
  INVOICE_CANCELLED = "INVOICE_CANCELLED",
  LINE_ITEM_ADDED = "LINE_ITEM_ADDED",
  TAX_CALCULATED = "TAX_CALCULATED",
  PAYMENT_RECORDED = "PAYMENT_RECORDED",
  PAYMENT_REFUNDED = "PAYMENT_REFUNDED",
}

export interface FinancialAuditLog {
  eventType: FinancialEventType;
  invoiceId?: string;
  patientId?: string;
  userId?: string;
  details: Record<string, unknown>;
  timestamp: string;
}

export class FinancialAuditService {
  constructor(private readonly logger: Logger) {}

  log(eventType: FinancialEventType, details: Record<string, unknown>): void {
    const auditEntry: FinancialAuditLog = {
      eventType,
      details: this.sanitize(details),
      timestamp: new Date().toISOString(),
    };

    this.logger.info(auditEntry, `FINANCIAL_AUDIT: ${eventType}`);
  }

  private sanitize(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitive = [
      "amount",
      "payment",
      "card",
      "account",
      "ssn",
      "reference",
    ];
    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      const keyLower = key.toLowerCase();
      sanitized[key] = sensitive.some((s) => keyLower.includes(s))
        ? "[REDACTED]"
        : value;
    }

    return sanitized;
  }
}
