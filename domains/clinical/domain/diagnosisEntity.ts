import { v4 as uuidv4 } from "uuid";

export enum DiagnosisStatus {
  ACTIVE = "ACTIVE",
  RESOLVED = "RESOLVED",
  INACTIVE = "INACTIVE",
}

export class Diagnosis {
  public readonly id: string;
  public readonly patientId: string;
  public readonly encounterId: string | null;
  public readonly code: string;
  public readonly description: string;
  public readonly recordedBy: string;

  private _status: DiagnosisStatus;
  private _onsetDate: Date | null;
  private _resolvedDate: Date | null;
  private _recordedAt: Date;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    patientId: string,
    encounterId: string | null,
    code: string,
    description: string,
    status: DiagnosisStatus,
    onsetDate: Date | null,
    resolvedDate: Date | null,
    recordedBy: string,
    recordedAt: Date,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.encounterId = encounterId;
    this.code = code;
    this.description = description;
    this.recordedBy = recordedBy;
    this._status = status;
    this._onsetDate = onsetDate;
    this._resolvedDate = resolvedDate;
    this._recordedAt = recordedAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(props: {
    patientId: string;
    encounterId?: string;
    code: string;
    description: string;
    onsetDate?: Date;
    recordedBy: string;
  }): Diagnosis {
    const now = new Date();
    return new Diagnosis(
      uuidv4(),
      props.patientId,
      props.encounterId ?? null,
      props.code,
      props.description,
      DiagnosisStatus.ACTIVE,
      props.onsetDate ?? null,
      null,
      props.recordedBy,
      now,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    patientId: string;
    encounterId: string | null;
    code: string;
    description: string;
    status: string;
    onsetDate: Date | string | null;
    resolvedDate: Date | string | null;
    recordedBy: string;
    recordedAt: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): Diagnosis {
    return new Diagnosis(
      props.id,
      props.patientId,
      props.encounterId,
      props.code,
      props.description,
      props.status as DiagnosisStatus,
      props.onsetDate ? new Date(props.onsetDate) : null,
      props.resolvedDate ? new Date(props.resolvedDate) : null,
      props.recordedBy,
      new Date(props.recordedAt),
      new Date(props.createdAt),
      new Date(props.updatedAt),
    );
  }

  get status(): DiagnosisStatus {
    return this._status;
  }
  get onsetDate(): Date | null {
    return this._onsetDate;
  }
  get resolvedDate(): Date | null {
    return this._resolvedDate;
  }
  get recordedAt(): Date {
    return this._recordedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  resolve(): void {
    this._status = DiagnosisStatus.RESOLVED;
    this._resolvedDate = new Date();
    this._updatedAt = new Date();
  }

  deactivate(): void {
    this._status = DiagnosisStatus.INACTIVE;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      encounterId: this.encounterId,
      code: this.code,
      description: this.description,
      status: this._status,
      onsetDate: this._onsetDate?.toISOString() ?? null,
      resolvedDate: this._resolvedDate?.toISOString() ?? null,
      recordedBy: this.recordedBy,
      recordedAt: this._recordedAt.toISOString(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
