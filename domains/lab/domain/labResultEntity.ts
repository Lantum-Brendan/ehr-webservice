import { v4 as uuidv4 } from "uuid";

export enum LabResultFlag {
  ABNORMAL = "ABNORMAL",
  NORMAL = "NORMAL",
  CRITICAL = "CRITICAL",
}

export enum LabResultStatus {
  PENDING = "PENDING",
  PRELIMINARY = "PRELIMINARY",
  FINAL = "FINAL",
  CORRECTED = "CORRECTED",
}

export class LabResult {
  public readonly id: string;
  public readonly labOrderId: string;
  public readonly testName: string;

  private _value: string | null;
  private _unit: string | null;
  private _referenceRange: string | null;
  private _flag: LabResultFlag | null;
  private _status: LabResultStatus;
  private _performedAt: Date | null;
  private _resultedAt: Date;
  private _createdAt: Date;

  private constructor(
    id: string,
    labOrderId: string,
    testName: string,
    value: string | null,
    unit: string | null,
    referenceRange: string | null,
    flag: LabResultFlag | null,
    status: LabResultStatus,
    performedAt: Date | null,
    resultedAt: Date,
    createdAt: Date,
  ) {
    this.id = id;
    this.labOrderId = labOrderId;
    this.testName = testName;
    this._value = value;
    this._unit = unit;
    this._referenceRange = referenceRange;
    this._flag = flag;
    this._status = status;
    this._performedAt = performedAt;
    this._resultedAt = resultedAt;
    this._createdAt = createdAt;
  }

  static create(props: {
    labOrderId: string;
    testName: string;
    value?: string;
    unit?: string;
    referenceRange?: string;
  }): LabResult {
    const now = new Date();
    const flag = props.value ? LabResultFlag.NORMAL : null;

    return new LabResult(
      uuidv4(),
      props.labOrderId,
      props.testName,
      props.value ?? null,
      props.unit ?? null,
      props.referenceRange ?? null,
      flag,
      LabResultStatus.PENDING,
      null,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    labOrderId: string;
    testName: string;
    value: string | null;
    unit: string | null;
    referenceRange: string | null;
    flag: string | null;
    status: string;
    performedAt: Date | string | null;
    resultedAt: Date | string;
    createdAt: Date | string;
  }): LabResult {
    return new LabResult(
      props.id,
      props.labOrderId,
      props.testName,
      props.value,
      props.unit,
      props.referenceRange,
      props.flag as LabResultFlag,
      props.status as LabResultStatus,
      props.performedAt ? new Date(props.performedAt) : null,
      new Date(props.resultedAt),
      new Date(props.createdAt),
    );
  }

  get value(): string | null {
    return this._value;
  }
  get unit(): string | null {
    return this._unit;
  }
  get referenceRange(): string | null {
    return this._referenceRange;
  }
  get flag(): LabResultFlag | null {
    return this._flag;
  }
  get status(): LabResultStatus {
    return this._status;
  }
  get performedAt(): Date | null {
    return this._performedAt;
  }
  get resultedAt(): Date {
    return this._resultedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }

  setResult(value: string, flag: LabResultFlag): void {
    this._value = value;
    this._flag = flag;
    this._status = LabResultStatus.FINAL;
    this._resultedAt = new Date();
  }

  isAbnormal(): boolean {
    return (
      this._flag === LabResultFlag.ABNORMAL ||
      this._flag === LabResultFlag.CRITICAL
    );
  }

  toJSON() {
    return {
      id: this.id,
      labOrderId: this.labOrderId,
      testName: this.testName,
      value: this._value,
      unit: this._unit,
      referenceRange: this._referenceRange,
      flag: this._flag,
      status: this._status,
      performedAt: this._performedAt?.toISOString() ?? null,
      resultedAt: this._resultedAt.toISOString(),
      createdAt: this._createdAt.toISOString(),
    };
  }
}
