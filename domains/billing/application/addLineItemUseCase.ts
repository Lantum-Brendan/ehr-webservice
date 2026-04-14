import { InvoiceLineItem } from "../domain/invoiceLineItemEntity.js";
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
    private readonly auditService: FinancialAuditService,
    private readonly logger: Logger,
  ) {}

  async execute(input: AddLineItemInput): Promise<InvoiceLineItem> {
    this.logger.info(
      { invoiceId: input.invoiceId },
      "Adding line item to invoice",
    );

    try {
      const result = await this.billingRepo.withSerializableTransaction(
        async (repo) => {
          const invoice = await repo.findInvoiceById(input.invoiceId);
          if (!invoice) {
            throw new NotFoundError(`Invoice ${input.invoiceId} not found`);
          }

          if (invoice.status !== InvoiceStatus.DRAFT) {
            throw new BadRequestError(
              "Can only add line items to draft invoices",
            );
          }

          const lineItem = InvoiceLineItem.create({
            invoiceId: input.invoiceId,
            description: input.description,
            cptCode: input.cptCode,
            quantity: input.quantity,
            unitPrice: input.unitPrice,
          });

          await repo.saveLineItem(lineItem);

          const lineItems = await repo.findLineItemsByInvoiceId(input.invoiceId);
          invoice.calculateTotals(lineItems);
          await repo.saveInvoice(invoice);

          return { invoice, lineItem };
        },
      );

      this.auditService.log(FinancialEventType.LINE_ITEM_ADDED, {
        lineItemId: result.lineItem.id,
        invoiceId: input.invoiceId,
        description: input.description,
        cptCode: input.cptCode,
        quantity: input.quantity,
        unitPrice: input.unitPrice,
        lineItemTotal: result.lineItem.total,
      });

      this.auditService.log(FinancialEventType.TAX_CALCULATED, {
        invoiceId: input.invoiceId,
        jurisdiction: result.invoice.jurisdiction,
        subtotal: result.invoice.subtotal,
        tax: result.invoice.tax,
        total: result.invoice.total,
      });

      this.logger.info(
        { lineItemId: result.lineItem.id },
        "Line item added successfully",
      );
      return result.lineItem;
    } catch (error) {
      if (isSerializableTransactionConflict(error)) {
        throw new ConflictError(
          "Invoice changed while adding the line item. Retry the request.",
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
