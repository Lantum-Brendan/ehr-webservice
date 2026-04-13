import { Payment, PaymentMethod } from "../domain/paymentEntity.js";
import { InvoiceStatus } from "../domain/invoiceEntity.js";
import { IBillingRepository } from "../domain/billingRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.js";

interface RecordPaymentInput {
  invoiceId: string;
  amount: number;
  method: string;
  reference?: string;
}

export class RecordPaymentUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: RecordPaymentInput): Promise<Payment> {
    this.logger.info(
      { invoiceId: input.invoiceId, method: input.method },
      "Recording payment for invoice",
    );

    const invoice = await this.billingRepo.findInvoiceById(input.invoiceId);
    if (!invoice) {
      throw new NotFoundError(`Invoice ${input.invoiceId} not found`);
    }

    if (invoice.status === InvoiceStatus.PAID) {
      throw new BadRequestError("Invoice is already paid");
    }

    if (invoice.status === InvoiceStatus.CANCELLED) {
      throw new BadRequestError("Cannot record payment on cancelled invoice");
    }

    const payment = Payment.create({
      invoiceId: input.invoiceId,
      amount: input.amount,
      method: input.method as PaymentMethod,
      reference: input.reference,
    });

    payment.markAsCompleted();

    const result = await this.billingRepo.executeInTransaction(async () => {
      await this.billingRepo.savePayment(payment);

      const payments = await this.billingRepo.findPaymentsByInvoiceId(
        input.invoiceId,
      );
      const totalPaid =
        payments.reduce((sum, p) => sum + p.amount, 0) + input.amount;

      if (totalPaid >= invoice.total) {
        invoice.markAsPaid();
        await this.billingRepo.saveInvoice(invoice);
      }

      return payment;
    });

    this.logger.info(
      {
        paymentId: result.id,
        invoiceId: input.invoiceId,
        method: input.method,
      },
      "Payment recorded successfully",
    );
    return result;
  }
}
