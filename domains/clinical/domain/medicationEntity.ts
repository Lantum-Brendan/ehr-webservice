import { v4 as uuidv4 } from "uuid";

export enum MedicationStatus {
  ACTIVE = "ACTIVE",
  DISCONTINUED = "DISCONTINUED",
  ON_HOLD = "ON_HOLD",
}

export enum MedicationRoute {
  ORAL = "ORAL",
  IV = "IV",
  IM = "IM",
  SC = "SC",
  TOPICAL = "TOPICAL",
  INHALED = "INHALED",
  RECTAL = "RECTAL",
  SUBLINGUAL = "SUBLINGUAL",
}

export class Medication {
  public readonly id: string;
  public readonly patientId: string;
  public readonly encounterId: string | null;
  public readonly name: string;
  public readonly dosage: string;
  public readonly frequency: string;
  public readonly route: MedicationRoute;
  public readonly prescribedBy: string;
  public readonly startDate: Date;

  private _status: MedicationStatus;
  private _endDate: Date | null;
  private _prescribedAt: Date;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    patientId: string,
    encounterId: string | null,
    name: string,
    dosage: string,
    frequency: string,
    route: MedicationRoute,
    status: MedicationStatus,
    startDate: Date,
    endDate: Date | null,
    prescribedBy: string,
    prescribedAt: Date,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.patientId = patientId;
    this.encounterId = encounterId;
    this.name = name;
    this.dosage = dosage;
    this.frequency = frequency;
    this.route = route;
    this.prescribedBy = prescribedBy;
    this.startDate = startDate;
    this._status = status;
    this._endDate = endDate;
    this._prescribedAt = prescribedAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(props: {
    patientId: string;
    encounterId?: string;
    name: string;
    dosage: string;
    frequency: string;
    route: MedicationRoute;
    startDate: Date;
    prescribedBy: string;
  }): Medication {
    const now = new Date();
    return new Medication(
      uuidv4(),
      props.patientId,
      props.encounterId ?? null,
      props.name,
      props.dosage,
      props.frequency,
      props.route,
      MedicationStatus.ACTIVE,
      props.startDate,
      null,
      props.prescribedBy,
      now,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    patientId: string;
    encounterId: string | null;
    name: string;
    dosage: string;
    frequency: string;
    route: string;
    status: string;
    startDate: Date | string;
    endDate: Date | string | null;
    prescribedBy: string;
    prescribedAt: Date | string;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): Medication {
    return new Medication(
      props.id,
      props.patientId,
      props.encounterId,
      props.name,
      props.dosage,
      props.frequency,
      props.route as MedicationRoute,
      props.status as MedicationStatus,
      new Date(props.startDate),
      props.endDate ? new Date(props.endDate) : null,
      props.prescribedBy,
      new Date(props.prescribedAt),
      new Date(props.createdAt),
      new Date(props.updatedAt),
    );
  }

  get status(): MedicationStatus {
    return this._status;
  }
  get endDate(): Date | null {
    return this._endDate;
  }
  get prescribedAt(): Date {
    return this._prescribedAt;
  }
  get createdAt(): Date {
    return this._createdAt;
  }
  get updatedAt(): Date {
    return this._updatedAt;
  }

  discontinue(endDate?: Date): void {
    this._status = MedicationStatus.DISCONTINUED;
    this._endDate = endDate ?? new Date();
    this._updatedAt = new Date();
  }

  putOnHold(): void {
    this._status = MedicationStatus.ON_HOLD;
    this._updatedAt = new Date();
  }

  resume(): void {
    this._status = MedicationStatus.ACTIVE;
    this._updatedAt = new Date();
  }

  toJSON() {
    return {
      id: this.id,
      patientId: this.patientId,
      encounterId: this.encounterId,
      name: this.name,
      dosage: this.dosage,
      frequency: this.frequency,
      route: this.route,
      status: this._status,
      startDate: this.startDate.toISOString(),
      endDate: this._endDate?.toISOString() ?? null,
      prescribedBy: this.prescribedBy,
      prescribedAt: this._prescribedAt.toISOString(),
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
