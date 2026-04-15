import { PrismaPatientRepository } from "../../patient/infrastructure/prismaPatientRepository.js";
import { PrismaClinicalRepository } from "../../clinical/infrastructure/prismaClinicalRepository.js";
import { PrismaLabRepository } from "../../lab/infrastructure/prismaLabRepository.js";
import type { PatientSummaryReport } from "../domain/reportTypes.js";
import { type Logger } from "@shared/logger/index.js";

export class GeneratePatientSummaryUseCase {
  constructor(private readonly logger: Logger) {}

  async execute(patientId: string): Promise<PatientSummaryReport> {
    this.logger.info({ patientId }, "Generating patient summary report");

    const patientRepo = new PrismaPatientRepository();
    const clinicalRepo = new PrismaClinicalRepository();
    const labRepo = new PrismaLabRepository();

    const patient = await patientRepo.findById(patientId);
    if (!patient) {
      throw new Error(`Patient ${patientId} not found`);
    }

    const [allergies, diagnoses, medications, labOrders] = await Promise.all([
      clinicalRepo.findAllergiesByPatientId(patientId),
      clinicalRepo.findDiagnosesByPatientId(patientId),
      clinicalRepo.findMedicationsByPatientId(patientId),
      labRepo.findOrdersByPatientId(patientId),
    ]);

    const activeDiagnoses = diagnoses.filter((d) => d.status === "ACTIVE");
    const activeMedications = medications.filter((m) => m.status === "ACTIVE");

    const recentLabOrders = await Promise.all(
      labOrders.slice(0, 5).map(async (order) => {
        const results = await labRepo.findResultsByOrderId(order.id);
        return {
          id: order.id,
          testType: order.testType,
          status: order.status,
          orderedAt: order.orderedAt.toISOString(),
          results: results.map((r) => ({
            testName: r.testName,
            value: r.value,
            flag: r.flag,
          })),
        };
      }),
    );

    const report: PatientSummaryReport = {
      patient: {
        id: patient.id,
        mrn: patient.mrn,
        name: `${patient.firstNameValue} ${patient.lastNameValue}`,
        dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
      },
      allergies: allergies.map((a) => ({
        allergen: a.allergen,
        type: a.type,
        severity: a.severity,
        status: a.status,
      })),
      activeDiagnoses: activeDiagnoses.map((d) => ({
        code: d.code,
        description: d.description,
        onsetDate: d.onsetDate?.toISOString() ?? "",
      })),
      activeMedications: activeMedications.map((m) => ({
        name: m.name,
        dosage: m.dosage,
        frequency: m.frequency,
        route: m.route,
      })),
      recentLabOrders,
      generatedAt: new Date().toISOString(),
    };

    this.logger.info({ patientId }, "Patient summary report generated");
    return report;
  }
}
