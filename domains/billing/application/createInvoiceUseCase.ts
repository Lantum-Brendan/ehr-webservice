import { Invoice } from "../domain/invoiceEntity.js";
import { IBillingRepository } from "../domain/billingRepository.js";
import {
  FinancialAuditService,
  FinancialEventType,
} from "../infrastructure/financialAuditService.js";
import { type Logger } from "@shared/logger/index.js";
import { BadRequestError, NotFoundError } from "@core/errors/appError.js";

interface CreateInvoiceInput {
  patientId: string;
  encounterId?: string;
  jurisdiction?: string;
  notes?: string;
  dueDate?: Date | string;
}

export class CreateInvoiceUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly auditService: FinancialAuditService,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateInvoiceInput): Promise<Invoice> {
    this.logger.info({ patientId: input.patientId }, "Creating new invoice");

    if (input.encounterId) {
      const encounterPatientId = await this.billingRepo.findEncounterPatientId(
        input.encounterId,
      );

      if (!encounterPatientId) {
        throw new NotFoundError(`Encounter ${input.encounterId} not found`);
      }

      if (encounterPatientId !== input.patientId) {
        throw new BadRequestError("Encounter does not belong to patient");
      }
    }

    const invoice = Invoice.create({
      patientId: input.patientId,
      encounterId: input.encounterId,
      jurisdiction: input.jurisdiction,
      notes: input.notes,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
    });

    await this.billingRepo.saveInvoice(invoice);

    this.auditService.log(FinancialEventType.INVOICE_CREATED, {
      invoiceId: invoice.id,
      patientId: invoice.patientId,
      encounterId: invoice.encounterId,
      jurisdiction: invoice.jurisdiction,
      status: invoice.status,
    });

    this.logger.info({ invoiceId: invoice.id }, "Invoice created successfully");
    return invoice;
  }
}
