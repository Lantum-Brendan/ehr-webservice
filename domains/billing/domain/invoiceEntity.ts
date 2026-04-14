import { v4 as uuidv4 } from "uuid";
import { calculateTax } from "./taxConfig.js";

export enum InvoiceStatus {
  DRAFT = "DRAFT",
  SENT = "SENT",
  PAID = "PAID",
  OVERDUE = "OVERDUE",
  CANCELLED = "CANCELLED",
}

export class Invoice {
  public readonly id: string;
  public readonly patientId: string;
  public readonly encounterId: string | null;
  public readonly jurisdiction: string | null;

  private _status: InvoiceStatus;
  private _subtotal: number;
  private _tax: number;
  private _total: number;
  private _dueDate: Date | null;
  private _paidAt: Date | null;
  private _notes: string | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    patientId: string,
    encounterId: string | null,
    jurisdiction: string | null,
    status: InvoiceStatus,
    subtotal: number,
    tax: number,
    total: number,
    dueDate: Date | null,
    paidAt: Date | null,
    notes: string | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.encounterId = encounterId;
    this.jurisdiction = jurisdiction;
    this._status = status;
    this._subtotal = subtotal;
    this._tax = tax;
    this._total = total;
    this._dueDate = dueDate;
    this._paidAt = paidAt;
    this._notes = notes;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(props: {
    patientId: string;
    encounterId?: string;
    jurisdiction?: string;
    notes?: string;
    dueDate?: Date;
  }): Invoice {
    const now = new Date();
    return new Invoice(
      uuidv4(),
      props.patientId,
      props.encounterId ?? null,
      props.jurisdiction ?? null,
      InvoiceStatus.DRAFT,
      0,
      0,
      0,
      props.dueDate ?? null,
      null,
      props.notes ?? null,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    patientId: string;
    encounterId: string | null;
    jurisdiction: string | null;
    status: string;
    subtotal: number;
    tax: number;
    total: number;
    dueDate: Date | string | null;
    paidAt: Date | string | null;
    notes: string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): Invoice {
    return new Invoice(
      props.id,
      props.patientId,
      props.encounterId,
      props.jurisdiction,
      props.status as InvoiceStatus,
      props.subtotal,
      props.tax,
      props.total,
      props.dueDate ? new Date(props.dueDate) : null,
      props.paidAt ? new Date(props.paidAt) : null,
      props.notes,
      new Date(props.createdAt),
      new Date(props.updatedAt),
    );
  }

  get status(): InvoiceStatus {
    return this._status;
  }

  get subtotal(): number {
    return this._subtotal;
  }

  get tax(): number {
    return this._tax;
  }

  get total(): number {
    return this._total;
  }

  get dueDate(): Date | null {
    return this._dueDate;
  }

  get paidAt(): Date | null {
    return this._paidAt;
  }

  get notes(): string | null {
    return this._notes;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isDraft(): boolean {
    return this._status === InvoiceStatus.DRAFT;
  }

  isPaid(): boolean {
    return this._status === InvoiceStatus.PAID;
  }

  calculateTotals(lineItems: { total: number }[]): void {
    this._subtotal = roundMoney(
      lineItems.reduce((sum, item) => sum + item.total, 0),
    );
    this._tax = calculateTax(this._subtotal, this.jurisdiction ?? undefined);
    this._total = roundMoney(this._subtotal + this._tax);
    this._updatedAt = new Date();
  }

  setStatus(status: InvoiceStatus): void {
    this._status = status;
    if (status === InvoiceStatus.PAID && !this._paidAt) {
      this._paidAt = new Date();
    }
    this._updatedAt = new Date();
  }

  markAsSent(): void {
    if (this._status !== InvoiceStatus.DRAFT) {
      throw new Error("Only draft invoices can be marked as sent");
    }
    this._status = InvoiceStatus.SENT;
    this._updatedAt = new Date();
  }

  markAsPaid(): void {
    if (this._status === InvoiceStatus.PAID) {
      throw new Error("Invoice is already paid");
    }
    this._status = InvoiceStatus.PAID;
    this._paidAt = new Date();
    this._updatedAt = new Date();
  }

  cancel(): void {
    if (this._status === InvoiceStatus.PAID) {
      throw new Error("Cannot cancel a paid invoice");
    }
    this._status = InvoiceStatus.CANCELLED;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      encounterId: this.encounterId,
      jurisdiction: this.jurisdiction,
      status: this._status,
      subtotal: this._subtotal,
      tax: this._tax,
      total: this._total,
      dueDate: this._dueDate?.toISOString() ?? null,
      paidAt: this._paidAt?.toISOString() ?? null,
      notes: this._notes,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}
