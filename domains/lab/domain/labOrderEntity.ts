import { v4 as uuidv4 } from "uuid";

export enum LabOrderStatus {
  ORDERED = "ORDERED",
  COLLECTED = "COLLECTED",
  IN_PROGRESS = "IN_PROGRESS",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum LabOrderPriority {
  STAT = "STAT",
  ROUTINE = "ROUTINE",
  URGENT = "URGENT",
}

export class LabOrder {
  public readonly id: string;
  public readonly patientId: string;
  public readonly encounterId: string | null;
  public readonly clinicianId: string;

  private _status: LabOrderStatus;
  private _priority: LabOrderPriority;
  private _testType: string;
  private _notes: string | null;
  private _orderedAt: Date;
  private _collectedAt: Date | null;
  private _completedAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    patientId: string,
    encounterId: string | null,
    clinicianId: string,
    status: LabOrderStatus,
    priority: LabOrderPriority,
    testType: string,
    notes: string | null,
    orderedAt: Date,
    collectedAt: Date | null,
    completedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.encounterId = encounterId;
    this.clinicianId = clinicianId;
    this._status = status;
    this._priority = priority;
    this._testType = testType;
    this._notes = notes;
    this._orderedAt = orderedAt;
    this._collectedAt = collectedAt;
    this._completedAt = completedAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(props: {
    patientId: string;
    clinicianId: string;
    encounterId?: string;
    testType: string;
    priority?: LabOrderPriority;
    notes?: string;
  }): LabOrder {
    const now = new Date();
    return new LabOrder(
      uuidv4(),
      props.patientId,
      props.encounterId ?? null,
      props.clinicianId,
      LabOrderStatus.ORDERED,
      props.priority ?? LabOrderPriority.ROUTINE,
      props.testType,
      props.notes ?? null,
      now,
      null,
      null,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    patientId: string;
    encounterId: string | null;
    clinicianId: string;
    status: string;
    priority: string;
    testType: string;
    notes: string | null;
    orderedAt: Date | string;
    collectedAt: Date | string | null;
    completedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): LabOrder {
    return new LabOrder(
      props.id,
      props.patientId,
      props.encounterId,
      props.clinicianId,
      props.status as LabOrderStatus,
      props.priority as LabOrderPriority,
      props.testType,
      props.notes,
      new Date(props.orderedAt),
      props.collectedAt ? new Date(props.collectedAt) : null,
      props.completedAt ? new Date(props.completedAt) : null,
      new Date(props.createdAt),
      new Date(props.updatedAt),
    );
  }

  get status(): LabOrderStatus {
    return this._status;
  }
  get priority(): LabOrderPriority {
    return this._priority;
  }
  get testType(): string {
    return this._testType;
  }
  get notes(): string | null {
    return this._notes;
  }
  get orderedAt(): Date {
    return this._orderedAt;
  }
  get collectedAt(): Date | null {
    return this._collectedAt;
  }
  get completedAt(): Date | null {
    return this._completedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  isCompleted(): boolean {
    return this._status === LabOrderStatus.COMPLETED;
  }

  markCollected(): void {
    if (this._status !== LabOrderStatus.ORDERED) {
      throw new Error("Can only collect ordered labs");
    }
    this._status = LabOrderStatus.COLLECTED;
    this._collectedAt = new Date();
    this._updatedAt = new Date();
  }

  markInProgress(): void {
    if (this._status !== LabOrderStatus.COLLECTED) {
      throw new Error("Can only start collected labs");
    }
    this._status = LabOrderStatus.IN_PROGRESS;
    this._updatedAt = new Date();
  }

  markCompleted(): void {
    if (this._status !== LabOrderStatus.IN_PROGRESS) {
      throw new Error("Can only complete in-progress labs");
    }
    this._status = LabOrderStatus.COMPLETED;
    this._completedAt = new Date();
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (this._status === LabOrderStatus.COMPLETED) {
      throw new Error("Cannot cancel completed lab");
    }
    this._status = LabOrderStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      encounterId: this.encounterId,
      clinicianId: this.clinicianId,
      status: this._status,
      priority: this._priority,
      testType: this._testType,
      notes: this._notes,
      orderedAt: this._orderedAt.toISOString(),
      collectedAt: this._collectedAt?.toISOString() ?? null,
      completedAt: this._completedAt?.toISOString() ?? null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
