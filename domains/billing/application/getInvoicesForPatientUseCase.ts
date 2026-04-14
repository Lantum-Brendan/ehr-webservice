import {
  IBillingRepository,
  PaginationParams,
  PaginatedResult,
} from "../domain/billingRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { Invoice } from "../domain/invoiceEntity.js";

export class GetInvoicesForPatientUseCase {
  constructor(
    private readonly billingRepo: IBillingRepository,
    private readonly logger: Logger,
  ) {}

  async execute(
    patientId: string,
    pagination?: PaginationParams,
  ): Promise<PaginatedResult<Invoice>> {
    this.logger.info(
      { patientId, page: pagination?.page, limit: pagination?.limit },
      "Fetching invoices for patient",
    );

    const result = await this.billingRepo.findInvoicesByPatientId(
      patientId,
      pagination,
    );

    this.logger.info(
      { count: result.data.length, total: result.total },
      "Invoices fetched successfully",
    );
    return result;
  }
}
