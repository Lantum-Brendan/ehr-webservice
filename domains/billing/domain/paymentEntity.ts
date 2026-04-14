import { v4 as uuidv4 } from "uuid";

export enum PaymentMethod {
  CASH = "CASH",
  CARD = "CARD",
  CHECK = "CHECK",
  BANK_TRANSFER = "BANK_TRANSFER",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
}

export class Payment {
  public readonly id: string;
  public readonly invoiceId: string;
  public readonly amount: number;
  public readonly method: PaymentMethod;
  public readonly reference: string | null;
  private _status: PaymentStatus;
  private _processedAt: Date | null;
  private _createdAt: Date;

  private constructor(
    id: string,
    invoiceId: string,
    amount: number,
    method: PaymentMethod,
    reference: string | null,
    status: PaymentStatus,
    processedAt: Date | null,
    createdAt: Date,
  ) {
    this.id = id;
    this.invoiceId = invoiceId;
    this.amount = amount;
    this.method = method;
    this.reference = reference;
    this._status = status;
    this._processedAt = processedAt;
    this._createdAt = createdAt;
  }

  static create(props: {
    invoiceId: string;
    amount: number;
    method: PaymentMethod;
    reference?: string;
  }): Payment {
    const now = new Date();
    return new Payment(
      uuidv4(),
      props.invoiceId,
      props.amount,
      props.method,
      props.reference ?? null,
      PaymentStatus.PENDING,
      null,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    invoiceId: string;
    amount: number;
    method: string;
    reference: string | null;
    status: string;
    processedAt: Date | string | null;
    createdAt: Date | string;
  }): Payment {
    return new Payment(
      props.id,
      props.invoiceId,
      props.amount,
      props.method as PaymentMethod,
      props.reference,
      props.status as PaymentStatus,
      props.processedAt ? new Date(props.processedAt) : null,
      new Date(props.createdAt),
    );
  }

  get status(): PaymentStatus {
    return this._status;
  }

  get processedAt(): Date | null {
    return this._processedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  markAsCompleted(): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new Error("Can only complete a pending payment");
    }
    this._status = PaymentStatus.COMPLETED;
    this._processedAt = new Date();
  }

  markAsFailed(): void {
    if (this._status !== PaymentStatus.PENDING) {
      throw new Error("Can only fail a pending payment");
    }
    this._status = PaymentStatus.FAILED;
    this._processedAt = new Date();
  }

  refund(): void {
    if (this._status !== PaymentStatus.COMPLETED) {
      throw new Error("Can only refund a completed payment");
    }
    this._status = PaymentStatus.REFUNDED;
  }

  toJSON() {
    return {
      id: this.id,
      invoiceId: this.invoiceId,
      amount: this.amount,
      method: this.method,
      reference: this.reference,
      status: this._status,
      processedAt: this._processedAt?.toISOString() ?? null,
      createdAt: this._createdAt.toISOString(),
    };
  }
}
