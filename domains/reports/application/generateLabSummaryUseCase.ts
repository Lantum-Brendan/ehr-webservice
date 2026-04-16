import { PrismaPatientRepository } from "../../patient/infrastructure/prismaPatientRepository.js";
import { PrismaLabRepository } from "../../lab/infrastructure/prismaLabRepository.js";
import type { LabSummaryReport } from "../domain/reportTypes.js";
import { type Logger } from "@shared/logger/index.js";
import { NotFoundError } from "@core/errors/appError.ts";

export class GenerateLabSummaryUseCase {
  constructor(private readonly logger: Logger) {}

  async execute(
    patientId: string,
    startDate: string,
    endDate: string,
  ): Promise<LabSummaryReport> {
    this.logger.info(
      { patientId, startDate, endDate },
      "Generating lab summary report",
    );

    const patientRepo = new PrismaPatientRepository();
    const labRepo = new PrismaLabRepository();

    const patient = await patientRepo.findById(patientId);
    if (!patient) {
      throw new NotFoundError(`Patient ${patientId} not found`);
    }

    const allOrders = await labRepo.findOrdersByPatientId(patientId);
    const start = new Date(startDate);
    const end = new Date(endDate);

    const ordersInRange = allOrders.filter(
      (o) => o.orderedAt >= start && o.orderedAt <= end,
    );

    let totalResults = 0;
    let abnormalResults = 0;

    const orders = await Promise.all(
      ordersInRange.map(async (order) => {
        const results = await labRepo.findResultsByOrderId(order.id);
        totalResults += results.length;
        abnormalResults += results.filter((r) => r.flag !== "NORMAL").length;

        return {
          id: order.id,
          testType: order.testType,
          status: order.status,
          orderedAt: order.orderedAt.toISOString(),
          completedAt: order.completedAt?.toISOString() ?? null,
          results: results.map((r) => ({
            testName: r.testName,
            value: r.value ?? "",
            unit: r.unit ?? "",
            flag: r.flag ?? "NORMAL",
            referenceRange: r.referenceRange ?? "",
          })),
        };
      }),
    );

    const report: LabSummaryReport = {
      patient: {
        id: patient.id,
        name: `${patient.firstNameValue} ${patient.lastNameValue}`,
      },
      dateRange: { start: startDate, end: endDate },
      orders,
      abnormalResults,
      totalResults,
      generatedAt: new Date().toISOString(),
    };

    this.logger.info(
      { patientId, orderCount: orders.length },
      "Lab summary report generated",
    );
    return report;
  }
}
