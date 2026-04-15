import { LabOrder } from "../domain/labOrderEntity.js";
import { LabResult } from "../domain/labResultEntity.js";
import { ILabRepository } from "../domain/labRepository.js";
import { type Logger } from "@shared/logger/index.js";

interface LabOrderWithResults {
  order: LabOrder;
  results: LabResult[];
}

export class GetLabOrderUseCase {
  constructor(
    private readonly labRepo: ILabRepository,
    private readonly logger: Logger,
  ) {}

  async execute(orderId: string): Promise<LabOrderWithResults | null> {
    this.logger.info({ orderId }, "Fetching lab order");

    const order = await this.labRepo.findOrderById(orderId);
    if (!order) return null;

    const results = await this.labRepo.findResultsByOrderId(orderId);
    return { order, results };
  }
}

export class GetLabOrdersForPatientUseCase {
  constructor(
    private readonly labRepo: ILabRepository,
    private readonly logger: Logger,
  ) {}

  async execute(patientId: string): Promise<LabOrder[]> {
    this.logger.info({ patientId }, "Fetching lab orders for patient");

    const orders = await this.labRepo.findOrdersByPatientId(patientId);
    this.logger.info({ count: orders.length }, "Lab orders fetched");
    return orders;
  }
}
