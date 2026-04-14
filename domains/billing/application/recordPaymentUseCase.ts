import {
  Payment,
  PaymentMethod,
  PaymentStatus,
} from "../domain/paymentEntity.js";
import { InvoiceStatus } from "../domain/invoiceEntity.js";
import { IBillingRepository } from "../domain/billingRepository.js";
import {
  FinancialAuditService,
  FinancialEventType,
} from "../infrastructure/financialAuditService.js";
import { Prisma } from "@prisma/client";
import { type Logger } from "@shared/logger/index.js";
import {
  NotFoundError,
  BadRequestError,
  ConflictError,
} from "@core/errors/appError.js";

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
}

interface PaymentValidationResult {
  valid: boolean;
  errors: string[];
}

function validatePaymentAmount(
  paymentAmount: number,
  invoiceTotal: number,
  totalPaid: number,
): PaymentValidationResult {
  const errors: string[] = [];

  if (paymentAmount <= 0) {
    errors.push("Payment amount must be positive");
  }

  if (paymentAmount > 100000) {
    errors.push("Payment amount exceeds maximum allowed");
  }

  if (roundMoney(paymentAmount + totalPaid) > invoiceTotal * 1.1) {
    errors.push("Payment exceeding invoice total by more than 10%");
  }

  return { valid: errors.length === 0, errors };
}

export class RecordPaymentUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly auditService: FinancialAuditService,
    private readonly logger: Logger,
  ) {}

  async execute(input: RecordPaymentInput): Promise<Payment> {
    this.logger.info(
      { invoiceId: input.invoiceId, method: input.method },
      "Recording payment for invoice",
    );

    try {
      const result = await this.billingRepo.withSerializableTransaction(
        async (repo) => {
          const invoice = await repo.findInvoiceById(input.invoiceId);
          if (!invoice) {
            throw new NotFoundError(`Invoice ${input.invoiceId} not found`);
          }

          if (invoice.status === InvoiceStatus.PAID) {
            throw new BadRequestError("Invoice is already paid");
          }

          if (invoice.status === InvoiceStatus.CANCELLED) {
            throw new BadRequestError(
              "Cannot record payment on cancelled invoice",
            );
          }

          const existingPayments = await repo.findPaymentsByInvoiceId(
            input.invoiceId,
          );
          const totalPaid = existingPayments
            .filter((payment) => payment.status === PaymentStatus.COMPLETED)
            .reduce((sum, payment) => sum + payment.amount, 0);

          const validation = validatePaymentAmount(
            input.amount,
            invoice.total,
            totalPaid,
          );
          if (!validation.valid) {
            throw new BadRequestError(validation.errors.join("; "));
          }

          const payment = Payment.create({
            invoiceId: input.invoiceId,
            amount: input.amount,
            method: input.method as PaymentMethod,
            reference: input.reference,
          });

          payment.markAsCompleted();
          await repo.savePayment(payment);

          const newTotalPaid = roundMoney(totalPaid + input.amount);
          if (newTotalPaid >= invoice.total) {
            invoice.markAsPaid();
            await repo.saveInvoice(invoice);
          }

          return { invoice, payment, totalPaid: newTotalPaid };
        },
      );

      this.auditService.log(FinancialEventType.PAYMENT_RECORDED, {
        paymentId: result.payment.id,
        invoiceId: input.invoiceId,
        method: input.method,
        invoiceTotal: result.invoice.total,
        totalPaid: result.totalPaid,
      });

      this.logger.info(
        {
          paymentId: result.payment.id,
          invoiceId: input.invoiceId,
          method: input.method,
        },
        "Payment recorded successfully",
      );
      return result.payment;
    } catch (error) {
      if (isSerializableTransactionConflict(error)) {
        throw new ConflictError(
          "Invoice payment state changed during processing. Retry the request.",
        );
      }

      throw error;
    }
  }
}

function isSerializableTransactionConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2034"
  );
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
