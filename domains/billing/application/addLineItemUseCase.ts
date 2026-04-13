import { InvoiceLineItem } from "../domain/invoiceLineItemEntity.js";
import { InvoiceStatus } from "../domain/invoiceEntity.js";
import { IBillingRepository } from "../domain/billingRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.js";

interface AddLineItemInput {
  invoiceId: string;
  description: string;
  cptCode?: string;
  quantity?: number;
  unitPrice: number;
}

export class AddLineItemUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: AddLineItemInput): Promise<InvoiceLineItem> {
    this.logger.info({ input }, "Adding line item to invoice");

    const invoice = await this.billingRepo.findInvoiceById(input.invoiceId);
    if (!invoice) {
      throw new NotFoundError(`Invoice ${input.invoiceId} not found`);
    }

    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestError("Can only add line items to draft invoices");
    }

    const lineItem = InvoiceLineItem.create({
      invoiceId: input.invoiceId,
      description: input.description,
      cptCode: input.cptCode,
      quantity: input.quantity,
      unitPrice: input.unitPrice,
    });

    await this.billingRepo.saveLineItem(lineItem);

    await this.recalculateInvoiceTotals(input.invoiceId);

    this.logger.info(
      { lineItemId: lineItem.id },
      "Line item added successfully",
    );
    return lineItem;
  }

  private async recalculateInvoiceTotals(invoiceId: string): Promise<void> {
    const lineItems =
      await this.billingRepo.findLineItemsByInvoiceId(invoiceId);
    const invoice = await this.billingRepo.findInvoiceById(invoiceId);

    if (invoice) {
      invoice.calculateTotals(lineItems);
      await this.billingRepo.saveInvoice(invoice);
    }
  }
}
