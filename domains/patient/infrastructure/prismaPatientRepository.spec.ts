import { describe, it, expect, vi, beforeEach } from "vitest";
import { Patient } from "../domain/patientEntity.js";

// Mock date utils
vi.mock("@core/utils/dateUtils.js", () => ({
  calculateAge: vi.fn(() => 35),
  isMinor: vi.fn(() => false),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "test-uuid-1"),
}));

// Mock Prisma client
const mockPatientRecord = {
  id: "test-uuid-1",
  mrn: "MRN123",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: new Date("1990-06-15"),
};

const prismaPatientMock = {
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  findMany: vi.fn(),
  upsert: vi.fn(),
  delete: vi.fn(),
};

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    patient: prismaPatientMock,
  },
}));

// Import after mocking
const { PrismaPatientRepository } =
  await import("./prismaPatientRepository.js");

describe("PrismaPatientRepository", () => {
  let repo: PrismaPatientRepository;

  beforeEach(() => {
    vi.clearAllMocks();
    repo = new PrismaPatientRepository();
  });

  describe("findById", () => {
    it("returns a Patient when found", async () => {
      prismaPatientMock.findUnique.mockResolvedValue(mockPatientRecord);

      const result = await repo.findById("test-uuid-1");

      expect(prismaPatientMock.findUnique).toHaveBeenCalledWith({
        where: { id: "test-uuid-1" },
      });
      expect(result).toBeInstanceOf(Patient);
      expect(result!.id).toBe("test-uuid-1");
      expect(result!.mrn).toBe("MRN123");
      expect(result!.firstNameValue).toBe("John");
    });

    it("returns null when not found", async () => {
      prismaPatientMock.findUnique.mockResolvedValue(null);

      const result = await repo.findById("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  describe("findByMrn", () => {
    it("returns a Patient when found", async () => {
      prismaPatientMock.findFirst.mockResolvedValue(mockPatientRecord);

      const result = await repo.findByMrn("MRN123");

      expect(prismaPatientMock.findFirst).toHaveBeenCalledWith({
        where: { mrn: "MRN123" },
      });
      expect(result).toBeInstanceOf(Patient);
      expect(result!.mrn).toBe("MRN123");
    });

    it("normalizes MRN to uppercase when searching", async () => {
      prismaPatientMock.findFirst.mockResolvedValue(mockPatientRecord);

      await repo.findByMrn("mrn123");

      expect(prismaPatientMock.findFirst).toHaveBeenCalledWith({
        where: { mrn: "MRN123" },
      });
    });

    it("returns null when not found", async () => {
      prismaPatientMock.findFirst.mockResolvedValue(null);

      const result = await repo.findByMrn("UNKNOWN");

      expect(result).toBeNull();
    });
  });

  describe("findAll", () => {
    it("returns all patients as Patient instances", async () => {
      const records = [
        mockPatientRecord,
        { ...mockPatientRecord, id: "test-uuid-2", mrn: "MRN456" },
      ];
      prismaPatientMock.findMany.mockResolvedValue(records);

      const result = await repo.findAll();

      expect(prismaPatientMock.findMany).toHaveBeenCalledWith();
      expect(result).toHaveLength(2);
      result.forEach((patient) => {
        expect(patient).toBeInstanceOf(Patient);
      });
    });

    it("returns empty array when no patients", async () => {
      prismaPatientMock.findMany.mockResolvedValue([]);

      const result = await repo.findAll();

      expect(result).toEqual([]);
    });
  });

  describe("save", () => {
    it("creates a new patient when id is new", async () => {
      const patient = Patient.create({
        mrn: "MRN789",
        firstName: "New",
        lastName: "Patient",
        dateOfBirth: "2000-01-01",
      });

      prismaPatientMock.upsert.mockResolvedValue(patient);

      await repo.save(patient);

      expect(prismaPatientMock.upsert).toHaveBeenCalledWith({
        where: { id: patient.id },
        update: {
          firstName: patient.firstNameValue,
          lastName: patient.lastNameValue,
          dateOfBirth: patient.dateOfBirthValue,
        },
        create: {
          id: patient.id,
          mrn: patient.mrn,
          firstName: patient.firstNameValue,
          lastName: patient.lastNameValue,
          dateOfBirth: patient.dateOfBirthValue,
        },
      });
    });

    it("updates an existing patient", async () => {
      const patient = Patient.create({
        mrn: "EXISTING",
        firstName: "Original",
        lastName: "Name",
        dateOfBirth: "1990-01-01",
      });
      patient.updateName("Updated", "Name");

      await repo.save(patient);

      expect(prismaPatientMock.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: patient.id },
          update: {
            firstName: "Updated",
            lastName: "Name",
            dateOfBirth: patient.dateOfBirthValue,
          },
        }),
      );
    });
  });

  describe("delete", () => {
    it("deletes a patient by id", async () => {
      prismaPatientMock.delete.mockResolvedValue(mockPatientRecord);

      await repo.delete("test-uuid-1");

      expect(prismaPatientMock.delete).toHaveBeenCalledWith({
        where: { id: "test-uuid-1" },
      });
    });
  });
});
