import { LabOrder } from "../domain/labOrderEntity.js";
import { LabResult } from "../domain/labResultEntity.js";
import { ILabRepository } from "../domain/labRepository.js";
import { prisma } from "@infrastructure/database/prisma.client.js";

export class PrismaLabRepository implements ILabRepository {
  constructor() {}

  async findOrderById(id: string): Promise<LabOrder | null> {
    const record = await prisma.labOrder.findUnique({
      where: { id },
      include: { results: true },
    });

    if (!record) return null;

    return LabOrder.rehydrate({
      id: record.id,
      patientId: record.patientId,
      encounterId: record.encounterId,
      clinicianId: record.clinicianId,
      status: record.status,
      priority: record.priority,
      testType: record.testType,
      notes: record.notes,
      orderedAt: record.orderedAt,
      collectedAt: record.collectedAt,
      completedAt: record.completedAt,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  async findOrdersByPatientId(patientId: string): Promise<LabOrder[]> {
    const records = await prisma.labOrder.findMany({
      where: { patientId },
      orderBy: { orderedAt: "desc" },
    });

    return records.map((r) =>
      LabOrder.rehydrate({
        id: r.id,
        patientId: r.patientId,
        encounterId: r.encounterId,
        clinicianId: r.clinicianId,
        status: r.status,
        priority: r.priority,
        testType: r.testType,
        notes: r.notes,
        orderedAt: r.orderedAt,
        collectedAt: r.collectedAt,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async findOrdersByEncounterId(encounterId: string): Promise<LabOrder[]> {
    const records = await prisma.labOrder.findMany({
      where: { encounterId },
      orderBy: { orderedAt: "desc" },
    });

    return records.map((r) =>
      LabOrder.rehydrate({
        id: r.id,
        patientId: r.patientId,
        encounterId: r.encounterId,
        clinicianId: r.clinicianId,
        status: r.status,
        priority: r.priority,
        testType: r.testType,
        notes: r.notes,
        orderedAt: r.orderedAt,
        collectedAt: r.collectedAt,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async findOrdersByStatus(status: string): Promise<LabOrder[]> {
    const records = await prisma.labOrder.findMany({
      where: { status },
      orderBy: { orderedAt: "desc" },
    });

    return records.map((r) =>
      LabOrder.rehydrate({
        id: r.id,
        patientId: r.patientId,
        encounterId: r.encounterId,
        clinicianId: r.clinicianId,
        status: r.status,
        priority: r.priority,
        testType: r.testType,
        notes: r.notes,
        orderedAt: r.orderedAt,
        collectedAt: r.collectedAt,
        completedAt: r.completedAt,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
      }),
    );
  }

  async saveOrder(order: LabOrder): Promise<void> {
    await prisma.labOrder.upsert({
      where: { id: order.id },
      update: {
        status: order.status,
        priority: order.priority,
        testType: order.testType,
        notes: order.notes,
        collectedAt: order.collectedAt,
        completedAt: order.completedAt,
      },
      create: {
        id: order.id,
        patientId: order.patientId,
        encounterId: order.encounterId,
        clinicianId: order.clinicianId,
        status: order.status,
        priority: order.priority,
        testType: order.testType,
        notes: order.notes,
        orderedAt: order.orderedAt,
        collectedAt: order.collectedAt,
        completedAt: order.completedAt,
      },
    });
  }

  async deleteOrder(id: string): Promise<void> {
    await prisma.labOrder.delete({ where: { id } });
  }

  async findResultsByOrderId(orderId: string): Promise<LabResult[]> {
    const records = await prisma.labResult.findMany({
      where: { labOrderId: orderId },
    });

    return records.map((r) =>
      LabResult.rehydrate({
        id: r.id,
        labOrderId: r.labOrderId,
        testName: r.testName,
        value: r.value,
        unit: r.unit,
        referenceRange: r.referenceRange,
        flag: r.flag,
        status: r.status,
        performedAt: r.performedAt,
        resultedAt: r.resultedAt,
        createdAt: r.createdAt,
      }),
    );
  }

  async saveResult(result: LabResult): Promise<void> {
    await prisma.labResult.upsert({
      where: { id: result.id },
      update: {
        value: result.value,
        flag: result.flag,
        status: result.status,
        performedAt: result.performedAt,
        resultedAt: result.resultedAt,
      },
      create: {
        id: result.id,
        labOrderId: result.labOrderId,
        testName: result.testName,
        value: result.value,
        unit: result.unit,
        referenceRange: result.referenceRange,
        flag: result.flag,
        status: result.status,
        performedAt: result.performedAt,
        resultedAt: result.resultedAt,
      },
    });
  }

  async deleteResult(id: string): Promise<void> {
    await prisma.labResult.delete({ where: { id } });
  }

  async executeInTransaction<T>(fn: () => Promise<T>): Promise<T> {
    return prisma.$transaction(fn);
  }
}
