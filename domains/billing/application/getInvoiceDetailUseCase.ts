import { Invoice } from "../domain/invoiceEntity.js";
import { InvoiceLineItem } from "../domain/invoiceLineItemEntity.js";
import { Payment } from "../domain/paymentEntity.js";
import { IBillingRepository } from "../domain/billingRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.js";

interface InvoiceDetail {
  invoice: Invoice;
  lineItems: InvoiceLineItem[];
  payments: Payment[];
}

export class GetInvoiceDetailUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly logger: Logger,
  ) {}

  async execute(invoiceId: string): Promise<InvoiceDetail> {
    this.logger.info({ invoiceId }, "Fetching invoice detail");

    const invoice = await this.billingRepo.findInvoiceById(invoiceId);
    if (!invoice) {
      throw new NotFoundError(`Invoice ${invoiceId} not found`);
    }

    const lineItems =
      await this.billingRepo.findLineItemsByInvoiceId(invoiceId);
    const payments = await this.billingRepo.findPaymentsByInvoiceId(invoiceId);

    return { invoice, lineItems, payments };
  }
}
