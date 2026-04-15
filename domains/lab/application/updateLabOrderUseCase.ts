import { LabOrder } from "../domain/labOrderEntity.js";
import { ILabRepository } from "../domain/labRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.js";

interface UpdateLabOrderInput {
  orderId: string;
  action: "COLLECT" | "IN_PROGRESS" | "COMPLETE" | "CANCEL";
}

export class UpdateLabOrderUseCase {
  constructor(
    private readonly labRepo: ILabRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: UpdateLabOrderInput): Promise<LabOrder> {
    this.logger.info(
      { orderId: input.orderId, action: input.action },
      "Updating lab order",
    );

    const order = await this.labRepo.findOrderById(input.orderId);
    if (!order) {
      throw new NotFoundError(`Lab order ${input.orderId} not found`);
    }

    switch (input.action) {
      case "COLLECT":
        order.markCollected();
        break;
      case "IN_PROGRESS":
        order.markInProgress();
        break;
      case "COMPLETE":
        order.markCompleted();
        break;
      case "CANCEL":
        order.cancel();
        break;
      default:
        throw new BadRequestError(`Invalid action: ${input.action}`);
    }

    await this.labRepo.saveOrder(order);
    this.logger.info(
      { orderId: order.id, status: order.status },
      "Lab order updated",
    );
    return order;
  }
}
