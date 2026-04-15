import { LabResult, LabResultFlag } from "../domain/labResultEntity.js";
import { ILabRepository } from "../domain/labRepository.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError, BadRequestError } from "@core/errors/appError.js";

interface AddLabResultInput {
  orderId: string;
  testName: string;
  value: string;
  unit?: string;
  referenceRange?: string;
  flag?: string;
}

export class AddLabResultUseCase {
  constructor(
    private readonly labRepo: ILabRepository,
    private readonly logger: Logger,
  ) {}

  async execute(input: AddLabResultInput): Promise<LabResult> {
    this.logger.info(
      { orderId: input.orderId, testName: input.testName },
      "Adding lab result",
    );

    const order = await this.labRepo.findOrderById(input.orderId);
    if (!order) {
      throw new NotFoundError(`Lab order ${input.orderId} not found`);
    }

    if (order.isCompleted()) {
      throw new BadRequestError("Cannot add results to completed order");
    }

    const result = LabResult.create({
      labOrderId: input.orderId,
      testName: input.testName,
      value: input.value,
      unit: input.unit,
      referenceRange: input.referenceRange,
    });

    if (input.flag) {
      result.setResult(input.value, input.flag as LabResultFlag);
    }

    await this.labRepo.saveResult(result);

    // Auto-complete order if all results are in
    const results = await this.labRepo.findResultsByOrderId(input.orderId);
    if (!order.isCompleted() && results.length > 0) {
      order.markInProgress();
      await this.labRepo.saveOrder(order);
    }

    this.logger.info({ resultId: result.id }, "Lab result added");
    return result;
  }
}
