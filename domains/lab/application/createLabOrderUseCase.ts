import { LabOrder } from "../domain/labOrderEntity.js";
import { ILabRepository } from "../domain/labRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.js";

interface CreateLabOrderInput {
  patientId: string;
  clinicianId: string;
  encounterId?: string;
  testType: string;
  priority?: string;
  notes?: string;
}

export class CreateLabOrderUseCase {
  constructor(
    private readonly labRepo: ILabRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreateLabOrderInput): Promise<LabOrder> {
    this.logger.info(
      { patientId: input.patientId, testType: input.testType },
      "Creating lab order",
    );

    const order = LabOrder.create({
      patientId: input.patientId,
      clinicianId: input.clinicianId,
      encounterId: input.encounterId,
      testType: input.testType,
      priority: input.priority as LabOrderPriority,
      notes: input.notes,
    });

    await this.labRepo.saveOrder(order);

    this.logger.info({ orderId: order.id }, "Lab order created");
    return order;
  }
}
