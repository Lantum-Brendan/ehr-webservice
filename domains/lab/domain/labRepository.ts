import { LabOrder } from "./labOrderEntity.js";
import { LabResult } from "./labResultEntity.js";

export interface ILabRepository {
  // Lab Order operations
  findOrderById(id: string): Promise<LabOrder | null>;
  findOrdersByPatientId(patientId: string): Promise<LabOrder[]>;
  findOrdersByEncounterId(encounterId: string): Promise<LabOrder[]>;
  findOrdersByStatus(status: string): Promise<LabOrder[]>;
  saveOrder(order: LabOrder): Promise<void>;
  deleteOrder(id: string): Promise<void>;

  // Lab Result operations
  findResultsByOrderId(orderId: string): Promise<LabResult[]>;
  saveResult(result: LabResult): Promise<void>;
  deleteResult(id: string): Promise<void>;

  // Transaction support
  executeInTransaction<T>(fn: () => Promise<T>): Promise<T>;
}
