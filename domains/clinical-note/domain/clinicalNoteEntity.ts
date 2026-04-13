import { v4 as uuidv4 } from "uuid";

export enum ClinicalNoteStatus {
  DRAFT = "DRAFT",
  SIGNED = "SIGNED",
}

export class ClinicalNote {
  public readonly id: string;
  public readonly encounterId: string;
  public readonly patientId: string;
  public readonly authorId: string;

  private _subjective: string | null;
  private _objective: string | null;
  private _assessment: string | null;
  private _plan: string | null;
  private _status: ClinicalNoteStatus;
  private _signedAt: Date | null;
  private _createdAt: Date;
  private _updatedAt: Date;

  private constructor(
    id: string,
    encounterId: string,
    patientId: string,
    authorId: string,
    subjective: string | null,
    objective: string | null,
    assessment: string | null,
    plan: string | null,
    status: ClinicalNoteStatus,
    signedAt: Date | null,
    createdAt: Date,
    updatedAt: Date,
  ) {
    this.id = id;
    this.encounterId = encounterId;
    this.patientId = patientId;
    this.authorId = authorId;
    this._subjective = subjective;
    this._objective = objective;
    this._assessment = assessment;
    this._plan = plan;
    this._status = status;
    this._signedAt = signedAt;
    this._createdAt = createdAt;
    this._updatedAt = updatedAt;
  }

  static create(props: {
    encounterId: string;
    patientId: string;
    authorId: string;
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  }): ClinicalNote {
    if (!props.encounterId) {
      throw new Error("Encounter ID is required");
    }
    if (!props.patientId) {
      throw new Error("Patient ID is required");
    }
    if (!props.authorId) {
      throw new Error("Author ID is required");
    }

    const now = new Date();
    return new ClinicalNote(
      uuidv4(),
      props.encounterId,
      props.patientId,
      props.authorId,
      props.subjective ?? null,
      props.objective ?? null,
      props.assessment ?? null,
      props.plan ?? null,
      ClinicalNoteStatus.DRAFT,
      null,
      now,
      now,
    );
  }

  static rehydrate(props: {
    id: string;
    encounterId: string;
    patientId: string;
    authorId: string;
    subjective: string | null;
    objective: string | null;
    assessment: string | null;
    plan: string | null;
    status: string;
    signedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }): ClinicalNote {
    const signedAt = props.signedAt ? new Date(props.signedAt) : null;
    return new ClinicalNote(
      props.id,
      props.encounterId,
      props.patientId,
      props.authorId,
      props.subjective,
      props.objective,
      props.assessment,
      props.plan,
      props.status as ClinicalNoteStatus,
      signedAt,
      new Date(props.createdAt),
      new Date(props.updatedAt),
    );
  }

  get subjective(): string | null {
    return this._subjective;
  }

  get objective(): string | null {
    return this._objective;
  }

  get assessment(): string | null {
    return this._assessment;
  }

  get plan(): string | null {
    return this._plan;
  }

  get status(): ClinicalNoteStatus {
    return this._status;
  }

  get signedAt(): Date | null {
    return this._signedAt;
  }

  get createdAt(): Date {
    return this._createdAt;
  }

  get updatedAt(): Date {
    return this._updatedAt;
  }

  isDraft(): boolean {
    return this._status === ClinicalNoteStatus.DRAFT;
  }

  isSigned(): boolean {
    return this._status === ClinicalNoteStatus.SIGNED;
  }

  updateContent(props: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  }): void {
    if (this._status === ClinicalNoteStatus.SIGNED) {
      throw new Error("Cannot update a signed clinical note");
    }

    if (props.subjective !== undefined) {
      this._subjective = props.subjective;
    }
    if (props.objective !== undefined) {
      this._objective = props.objective;
    }
    if (props.assessment !== undefined) {
      this._assessment = props.assessment;
    }
    if (props.plan !== undefined) {
      this._plan = props.plan;
    }

    this._updatedAt = new Date();
  }

  sign(authorId: string): void {
    if (this._status === ClinicalNoteStatus.SIGNED) {
      throw new Error("Clinical note is already signed");
    }

    if (this.authorId !== authorId) {
      throw new Error("Only the author can sign this clinical note");
    }

    this._status = ClinicalNoteStatus.SIGNED;
    this._signedAt = new Date();
    this._updatedAt = new Date();
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      encounterId: this.encounterId,
      patientId: this.patientId,
      authorId: this.authorId,
      subjective: this._subjective,
      objective: this._objective,
      assessment: this._assessment,
      plan: this._plan,
      status: this._status,
      signedAt: this._signedAt?.toISOString() ?? null,
      createdAt: this._createdAt.toISOString(),
      updatedAt: this._updatedAt.toISOString(),
    };
  }
}
