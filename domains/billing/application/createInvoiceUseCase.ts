import { Invoice } from "../domain/invoiceEntity.js";
import { IBillingRepository } from "../domain/billingRepository.js";
import { type Logger } from "@shared/logger/index.js";

interface CreateInvoiceInput {
  patientId: string;
  encounterId?: string;
  notes?: string;
  dueDate?: Date | string;
}

export class CreateInvoiceUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<Invoice> {
    this.logger.info({ input }, "Creating new invoice");

    const invoice = Invoice.create({
      patientId: input.patientId,
      encounterId: input.encounterId,
      notes: input.notes,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    });

    await this.billingRepo.saveInvoice(invoice);

    this.logger.info({ invoiceId: invoice.id }, "Invoice created successfully");
    return invoice;
  }
}
