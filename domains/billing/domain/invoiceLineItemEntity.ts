import { v4 as uuidv4 } from "uuid";

export class InvoiceLineItem {
  public readonly id: string;
  public readonly invoiceId: string;
  public readonly description: string;
  public readonly cptCode: string | null;
  public readonly quantity: number;
  public readonly unitPrice: number;
  public readonly total: number;
  public readonly createdAt: Date;

  private constructor(
    id: string,
    invoiceId: string,
    description: string,
    cptCode: string | null,
    quantity: number,
    unitPrice: number,
    total: number,
    createdAt: Date,
  ) {
    this.id = id;
    this.invoiceId = invoiceId;
    this.description = description;
    this.cptCode = cptCode;
    this.quantity = quantity;
    this.unitPrice = unitPrice;
    this.total = total;
    this.createdAt = createdAt;
  }

  static create(props: {
    invoiceId: string;
    description: string;
    cptCode?: string;
    quantity?: number;
    unitPrice: number;
  }): InvoiceLineItem {
    const quantity = props.quantity ?? 1;
    const total = quantity * props.unitPrice;
    const now = new Date();

    return new InvoiceLineItem(
      uuidv4(),
      props.invoiceId,
      props.description,
      props.cptCode ?? null,
      quantity,
      props.unitPrice,
      total,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    invoiceId: string;
    description: string;
    cptCode: string | null;
    quantity: number;
    unitPrice: number;
    total: number;
    createdAt: Date | string;
  }): InvoiceLineItem {
    return new InvoiceLineItem(
      props.id,
      props.invoiceId,
      props.description,
      props.cptCode,
      props.quantity,
      props.unitPrice,
      props.total,
      new Date(props.createdAt),
    );
  }

  toJSON() {
    return {
      id: this.id,
      invoiceId: this.invoiceId,
      description: this.description,
      cptCode: this.cptCode,
      quantity: this.quantity,
      unitPrice: this.unitPrice,
      total: this.total,
      createdAt: this.createdAt.toISOString(),
    };
  }
}
