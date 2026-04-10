import { v4 as uuidv4 } from "uuid";
import { isMinor, calculateAge } from "@core/utils/dateUtils.js";
import { Encounter } from "@domains/encounter/domain/encounterEntity.js";

export class Patient {
  // Identity - never changes
  public readonly id: string;
  public readonly mrn: string;

  // Mutable properties
  private firstName: string;
  private lastName: string;
  private dateOfBirth: Date;
  private encounters: Encounter[] = [];

  private constructor(
    id: string,
    mrn: string,
    firstName: string,
    lastName: string,
    dateOfBirth: Date,
  ) {
    this.id = id;
    this.mrn = mrn;
    this.firstName = firstName;
    this.lastName = lastName;
    this.dateOfBirth = dateOfBirth;
  }

  /**
   * Factory method - controls creation and validates business rules
   * @param props - Patient creation properties
   * @returns New Patient instance
   * @throws Error if MRN is invalid or names are empty
   */
  static create(props: {
    mrn: string;
    firstName: string;
    lastName: string;
    dateOfBirth: Date | string;
  }): Patient {
    // Business rule: MRN is required and must be valid format
    if (!props.mrn) {
      throw new Error("MRN is required");
    }

    const normalizedMrn = props.mrn.toUpperCase();
    if (!/^[A-Z0-9]{6,12}$/.test(normalizedMrn)) {
      throw new Error("MRN must be 6-12 uppercase alphanumeric characters");
    }

    // Business rule: Names cannot be empty or whitespace only
    if (!props.firstName.trim() || !props.lastName.trim()) {
      throw new Error("First and last name are required");
    }

    const birthDate =
      typeof props.dateOfBirth === "string"
        ? new Date(props.dateOfBirth)
        : props.dateOfBirth;

    // Business rule: Date of birth must be a valid past date
    if (isNaN(birthDate.getTime()) || birthDate > new Date()) {
      throw new Error("Date of birth must be a valid past date");
    }

    return new Patient(
      uuidv4(),
      props.mrn.toUpperCase(),
      props.firstName.trim(),
      props.lastName.trim(),
      birthDate,
    );
  }

  // Getters
  get firstNameValue(): string {
    return this.firstName;
  }

  get lastNameValue(): string {
    return this.lastName;
  }

  get dateOfBirthValue(): Date {
    return new Date(this.dateOfBirth);
  }

  // Derived properties - business logic lives here
  get age(): number {
    return calculateAge(this.dateOfBirth);
  }

  get fullName(): string {
    return `${this.firstName} ${this.lastName}`;
  }

  isMinor(): boolean {
    return isMinor(this.dateOfBirth);
  }

  // Domain behavior methods - encapsulate state changes
  updateName(firstName: string, lastName: string): void {
    // Business rule: Names cannot be empty
    if (!firstName.trim() || !lastName.trim()) {
      throw new Error("First and last name are required");
    }

    this.firstName = firstName.trim();
    this.lastName = lastName.trim();
  }

  // Encounter management - demonstrates aggregate root behavior
  addEncounter(encounter: Encounter): void {
    // Business rule: Encounter must belong to this patient
    if (encounter.patientId !== this.id) {
      throw new Error("Encounter patientId does not match Patient id");
    }

    this.encounters.push(encounter);
  }

  getEncounters(): Encounter[] {
    return [...this.encounters]; // Return copy to prevent external modification
  }

  // For testing/debugging - not part of public API
  toJSON() {
    return {
      id: this.id,
      mrn: this.mrn,
      firstName: this.firstName,
      lastName: this.lastName,
      dateOfBirth: this.dateOfBirth.toISOString(),
      age: this.age,
      encounterCount: this.encounters.length,
    };
  }
}
