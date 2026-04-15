import { v4 as uuidv4 } from "uuid";

export enum AllergyType {
  DRUG = "DRUG",
  FOOD = "FOOD",
  ENVIRONMENTAL = "ENVIRONMENTAL",
}

export enum AllergySeverity {
  MILD = "MILD",
  MODERATE = "MODERATE",
  SEVERE = "SEVERE",
  LIFE_THREATENING = "LIFE_THREATENING",
}

export enum AllergyStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  RESOLVED = "RESOLVED",
}

export class Allergy {
  public readonly id: string;
  public readonly patientId: string;
  public readonly allergen: string;
  public readonly type: AllergyType;
  public readonly severity: AllergySeverity;
  public readonly recordedBy: string;

  private _status: AllergyStatus;
  private _reaction: string | null;
  private _recordedAt: Date;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    patientId: string,
    allergen: string,
    type: AllergyType,
    severity: AllergySeverity,
    status: AllergyStatus,
    reaction: string | null,
    recordedBy: string,
    recordedAt: Date,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.allergen = allergen;
    this.type = type;
    this.severity = severity;
    this.recordedBy = recordedBy;
    this._status = status;
    this._reaction = reaction;
    this._recordedAt = recordedAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(props: {
    patientId: string;
    allergen: string;
    type: AllergyType;
    severity: AllergySeverity;
    reaction?: string;
    recordedBy: string;
  }): Allergy {
    const now = new Date();
    return new Allergy(
      uuidv4(),
      props.patientId,
      props.allergen,
      props.type,
      props.severity,
      AllergyStatus.ACTIVE,
      props.reaction ?? null,
      props.recordedBy,
      now,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    patientId: string;
    allergen: string;
    type: string;
    severity: string;
    status: string;
    reaction: string | null;
    recordedBy: string;
    recordedAt: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): Allergy {
    return new Allergy(
      props.id,
      props.patientId,
      props.allergen,
      props.type as AllergyType,
      props.severity as AllergySeverity,
      props.status as AllergyStatus,
      props.reaction,
      props.recordedBy,
      new Date(props.recordedAt),
      new Date(props.createdAt),
      new Date(props.updatedAt),
    );
  }

  get status(): AllergyStatus {
    return this._status;
  }
  get reaction(): string | null {
    return this._reaction;
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

  deactivate(): void {
    this._status = AllergyStatus.INACTIVE;
    this._updatedAt = new Date();
  }

  resolve(): void {
    this._status = AllergyStatus.RESOLVED;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      allergen: this.allergen,
      type: this.type,
      severity: this.severity,
      status: this._status,
      reaction: this._reaction,
      recordedBy: this.recordedBy,
      recordedAt: this._recordedAt.toISOString(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
