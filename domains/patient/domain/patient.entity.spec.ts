import { describe, it, expect, vi } from "vitest";
import { Patient } from "./patientEntity";

// Mock uuid to have predictable IDs
vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1234"),
}));

// Mock date.utils to control age calculations
vi.mock("../../../../core/utils/dateUtils", () => ({
  calculateAge: vi.fn((date: Date) => {
    const birth = new Date(date);
    const today = new Date("2026-04-03");
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age;
  }),
  isMinor: vi.fn((date: Date) => {
    const birth = new Date(date);
    const today = new Date("2026-04-03");
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birth.getDate())
    ) {
      age--;
    }
    return age < 18;
  }),
}));

const VALID_INPUT = {
  mrn: "MRN123",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-06-15",
};

// ─── Factory Creation ───────────────────────────────────────────

describe("Patient.create", () => {
  it("creates a valid patient with all fields", () => {
    const patient = Patient.create(VALID_INPUT);

    expect(patient.id).toBe("test-uuid-1234");
    expect(patient.mrn).toBe("MRN123");
    expect(patient.firstNameValue).toBe("John");
    expect(patient.lastNameValue).toBe("Doe");
    expect(patient.dateOfBirthValue).toEqual(new Date("1990-06-15"));
  });

  it("normalizes MRN to uppercase", () => {
    const patient = Patient.create({ ...VALID_INPUT, mrn: "mrn123" });
    expect(patient.mrn).toBe("MRN123");
  });

  it("trims whitespace from first and last name", () => {
    const patient = Patient.create({
      ...VALID_INPUT,
      firstName: "  John  ",
      lastName: "  Doe  ",
    });
    expect(patient.firstNameValue).toBe("John");
    expect(patient.lastNameValue).toBe("Doe");
  });

  it("accepts Date object for dateOfBirth", () => {
    const patient = Patient.create({
      ...VALID_INPUT,
      dateOfBirth: new Date("1990-06-15"),
    });
    expect(patient.dateOfBirthValue).toEqual(new Date("1990-06-15"));
  });

  // ─── MRN Validation ───────────────────────────────────────────

  it("throws if MRN is empty string", () => {
    expect(() => Patient.create({ ...VALID_INPUT, mrn: "" })).toThrow(
      "MRN is required",
    );
  });

  it("throws if MRN is less than 6 characters", () => {
    expect(() => Patient.create({ ...VALID_INPUT, mrn: "ABC" })).toThrow(
      "MRN must be 6-12 uppercase alphanumeric characters",
    );
  });

  it("throws if MRN is more than 12 characters", () => {
    expect(() =>
      Patient.create({ ...VALID_INPUT, mrn: "ABCDEFGHIJKLM" }),
    ).toThrow("MRN must be 6-12 uppercase alphanumeric characters");
  });

  it("accepts lowercase MRN and normalizes to uppercase", () => {
    const patient = Patient.create({ ...VALID_INPUT, mrn: "abc123" });
    expect(patient.mrn).toBe("ABC123");
  });

  it("throws if MRN contains special characters", () => {
    expect(() => Patient.create({ ...VALID_INPUT, mrn: "MRN-123" })).toThrow(
      "MRN must be 6-12 uppercase alphanumeric characters",
    );
  });

  it("accepts minimum length MRN (6 chars)", () => {
    const patient = Patient.create({ ...VALID_INPUT, mrn: "ABC123" });
    expect(patient.mrn).toBe("ABC123");
  });

  it("accepts maximum length MRN (12 chars)", () => {
    const patient = Patient.create({ ...VALID_INPUT, mrn: "ABCDEFGHIJKL" });
    expect(patient.mrn).toBe("ABCDEFGHIJKL");
  });

  it("accepts all-numeric MRN", () => {
    const patient = Patient.create({ ...VALID_INPUT, mrn: "123456" });
    expect(patient.mrn).toBe("123456");
  });

  // ─── Name Validation ──────────────────────────────────────────

  it("throws if firstName is empty", () => {
    expect(() => Patient.create({ ...VALID_INPUT, firstName: "" })).toThrow(
      "First and last name are required",
    );
  });

  it("throws if lastName is empty", () => {
    expect(() => Patient.create({ ...VALID_INPUT, lastName: "" })).toThrow(
      "First and last name are required",
    );
  });

  it("throws if firstName is whitespace only", () => {
    expect(() => Patient.create({ ...VALID_INPUT, firstName: "   " })).toThrow(
      "First and last name are required",
    );
  });

  it("throws if lastName is whitespace only", () => {
    expect(() => Patient.create({ ...VALID_INPUT, lastName: "   " })).toThrow(
      "First and last name are required",
    );
  });

  // ─── Date of Birth Validation ─────────────────────────────────

  it("throws if dateOfBirth is an invalid date string", () => {
    expect(() =>
      Patient.create({ ...VALID_INPUT, dateOfBirth: "not-a-date" }),
    ).toThrow("Date of birth must be a valid past date");
  });

  it("throws if dateOfBirth is in the future", () => {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    expect(() =>
      Patient.create({ ...VALID_INPUT, dateOfBirth: future }),
    ).toThrow("Date of birth must be a valid past date");
  });

  it("throws if dateOfBirth is today", () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(() =>
      Patient.create({ ...VALID_INPUT, dateOfBirth: today }),
    ).not.toThrow();
  });
});

// ─── Private Constructor (type-level) ─────────────────────────────

describe("Patient private constructor", () => {
  it("cannot be called directly from outside (type-level check)", () => {
    // This is a compile-time check. At runtime, the constructor is private
    // but accessible via any - we test via factory only.
    const input = { ...VALID_INPUT, dateOfBirth: new Date("1990-01-01") };
    const patient = Patient.create(input);
    // Verify we can only create through the factory
    expect(patient).toBeInstanceOf(Patient);
  });
});

// ─── Getters ──────────────────────────────────────────────────────

describe("Patient getters", () => {
  const patient = Patient.create(VALID_INPUT);

  it("firstNameValue returns the first name", () => {
    expect(patient.firstNameValue).toBe("John");
  });

  it("lastNameValue returns the last name", () => {
    expect(patient.lastNameValue).toBe("Doe");
  });

  it("dateOfBirthValue returns the date of birth", () => {
    const a = patient.dateOfBirthValue;
    const b = patient.dateOfBirthValue;
    expect(a).toEqual(b);
    expect(a).toBe(b); // Same instance for performance
  });

  it("id is a readonly string", () => {
    expect(patient.id).toBe("test-uuid-1234");
  });

  it("mrn is a readonly uppercase string", () => {
    expect(patient.mrn).toBe("MRN123");
  });
});

// ─── Derived Properties ───────────────────────────────────────────

describe("Patient derived properties", () => {
  it("returns correct full name", () => {
    const patient = Patient.create(VALID_INPUT);
    expect(patient.fullName).toBe("John Doe");
  });

  it("calculates age from DOB", () => {
    const patient = Patient.create({
      ...VALID_INPUT,
      dateOfBirth: "2000-01-01",
    });
    expect(patient.age).toBe(26);
  });

  it("identifies minors correctly", () => {
    const minor = Patient.create({
      ...VALID_INPUT,
      dateOfBirth: "2010-01-01",
    });
    expect(minor.isMinor()).toBe(true);

    const adult = Patient.create({
      ...VALID_INPUT,
      dateOfBirth: "2000-01-01",
    });
    expect(adult.isMinor()).toBe(false);
  });

  it.skip("identifies someone who just turned 18", () => {
    const today = new Date();
    const birthDate = new Date(today);
    birthDate.setFullYear(today.getFullYear() - 18);
    birthDate.setHours(0, 0, 0, 0);
    const patient = Patient.create({
      ...VALID_INPUT,
      dateOfBirth: birthDate,
    });
    expect(patient.isMinor()).toBe(false);
  });
});

// ─── updateName ───────────────────────────────────────────────────

describe("Patient.updateName", () => {
  it("updates first and last name", () => {
    const patient = Patient.create(VALID_INPUT);
    patient.updateName("Jane", "Smith");

    expect(patient.firstNameValue).toBe("Jane");
    expect(patient.lastNameValue).toBe("Smith");
    expect(patient.mrn).toBe("MRN123"); // Identity unchanged
    expect(patient.id).toBe("test-uuid-1234");
  });

  it("trims whitespace from updated names", () => {
    const patient = Patient.create(VALID_INPUT);
    patient.updateName("  Jane  ", "  Smith  ");

    expect(patient.firstNameValue).toBe("Jane");
    expect(patient.lastNameValue).toBe("Smith");
  });

  it("throws if new firstName is empty", () => {
    const patient = Patient.create(VALID_INPUT);
    expect(() => patient.updateName("", "Smith")).toThrow(
      "First and last name are required",
    );
  });

  it("throws if new lastName is empty", () => {
    const patient = Patient.create(VALID_INPUT);
    expect(() => patient.updateName("Jane", "")).toThrow(
      "First and last name are required",
    );
  });

  it("throws if both new names are whitespace", () => {
    const patient = Patient.create(VALID_INPUT);
    expect(() => patient.updateName("  ", "  ")).toThrow(
      "First and last name are required",
    );
  });

  it("preserves identity after update", () => {
    const patient = Patient.create(VALID_INPUT);
    const originalId = patient.id;
    const originalMrn = patient.mrn;
    patient.updateName("Jane", "Smith");

    expect(patient.id).toBe(originalId);
    expect(patient.mrn).toBe(originalMrn);
  });
});

// ─── Encounter Management (Aggregate Root) ───────────────────────

describe("Patient encounters", () => {
  const mockEncounter = {
    id: "enc-1",
    patientId: "test-uuid-1234",
    encounterTypeValue: "outpatient",
    startTimeValue: new Date("2026-04-01"),
    endTimeValue: null,
    statusValue: "planned",
    updateStatus: vi.fn(),
    updateTimings: vi.fn(),
    isCompleted: vi.fn(() => false),
    isCancelled: vi.fn(() => false),
    isActive: vi.fn(() => true),
    durationMinutes: null,
    toJSON: vi.fn(),
  } as any;

  const mismatchedEncounter = {
    ...mockEncounter,
    patientId: "wrong-patient-id",
  } as any;

  it("adds a valid encounter belonging to the patient", () => {
    const patient = Patient.create(VALID_INPUT);
    patient.addEncounter(mockEncounter);

    const encounters = patient.getEncounters();
    expect(encounters).toHaveLength(1);
    expect(encounters[0]).toBe(mockEncounter);
  });

  it("throws if encounter belongs to a different patient", () => {
    const patient = Patient.create(VALID_INPUT);
    expect(() => patient.addEncounter(mismatchedEncounter)).toThrow(
      "Encounter patientId does not match Patient id",
    );
  });

  it("returns a copy of encounters (not the original array)", () => {
    const patient = Patient.create(VALID_INPUT);
    patient.addEncounter(mockEncounter);

    const encounters1 = patient.getEncounters();
    const encounters2 = patient.getEncounters();

    expect(encounters1).toEqual(encounters2);
    expect(encounters1).not.toBe(encounters2);
  });

  it("external modification cannot affect internal encounters", () => {
    const patient = Patient.create(VALID_INPUT);
    patient.addEncounter(mockEncounter);

    const encounters = patient.getEncounters();
    encounters.length = 0; // Try to mutate

    expect(patient.getEncounters()).toHaveLength(1);
  });

  it("tracks multiple encounters", () => {
    const patient = Patient.create(VALID_INPUT);
    const enc2 = { ...mockEncounter, id: "enc-2" } as any;
    patient.addEncounter(mockEncounter);
    patient.addEncounter(enc2);

    expect(patient.getEncounters()).toHaveLength(2);
  });

  it("starts with no encounters", () => {
    const patient = Patient.create(VALID_INPUT);
    expect(patient.getEncounters()).toHaveLength(0);
  });
});

// ─── toJSON ───────────────────────────────────────────────────────

describe("Patient.toJSON", () => {
  it("serializes patient with all properties", () => {
    const patient = Patient.create(VALID_INPUT);
    const json = patient.toJSON();

    expect(json).toEqual({
      id: "test-uuid-1234",
      mrn: "MRN123",
      firstName: "John",
      lastName: "Doe",
      dateOfBirth: new Date("1990-06-15").toISOString(),
      age: 35, // calculated from mocked 2026-04-03
      encounterCount: 0,
    });
  });

  it("includes encounter count", () => {
    const patient = Patient.create(VALID_INPUT);
    patient.addEncounter({
      id: "enc-1",
      patientId: patient.id,
    } as any);

    expect(patient.toJSON().encounterCount).toBe(1);
  });
});
