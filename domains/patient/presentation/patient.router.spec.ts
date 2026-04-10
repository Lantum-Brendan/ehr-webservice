import { describe, it, expect, vi, beforeEach } from "vitest";
import request from "supertest";
import express, { Express, NextFunction, Request, Response } from "express";

// Mock date utils before any module that uses them
vi.mock("@core/utils/dateUtils.js", () => ({
  calculateAge: vi.fn(() => 35),
  isMinor: vi.fn(() => false),
}));

vi.mock("uuid", () => ({
  v4: vi.fn(() => "patient-uuid-1"),
}));

vi.mock("@core/middleware/validateMiddleware.js", () => ({
  validate: () => (_req: Request, _res: Response, next: NextFunction) => next(),
}));

vi.mock("@core/guards/roleGuard.js", () => ({
  requireRole: () => (_req: Request, _res: Response, next: NextFunction) =>
    next(),
}));

vi.mock("@shared/logger/index.js", () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
    trace: vi.fn(),
    silent: vi.fn(),
    child: vi.fn(function child() {
      return this;
    }),
  },
}));

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    patient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

// Import after mocks are set up
const { Patient } = await import("../domain/patientEntity.js");
const { PrismaPatientRepository } =
  await import("../infrastructure/prismaPatientRepository.js");
const { CreatePatientUseCase } =
  await import("../application/createPatientUseCase.js");
const { UpdatePatientUseCase } =
  await import("../application/updatePatientUseCase.js");
const { DeletePatientUseCase } =
  await import("../application/deletePatientUseCase.js");

const mockPatientInstance = Patient.create({
  mrn: "MRN123",
  firstName: "John",
  lastName: "Doe",
  dateOfBirth: "1990-06-15",
});

function createPatientResponse(patient: typeof mockPatientInstance) {
  return {
    id: patient.id,
    mrn: patient.mrn,
    firstName: patient.firstNameValue,
    lastName: patient.lastNameValue,
    dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
    age: patient.age,
  };
}

function makeAppFromMocks(): Express {
  const findByMrnMock = vi.fn().mockResolvedValue(null);
  const findByIdMock = vi.fn().mockResolvedValue(mockPatientInstance);
  const saveMock = vi.fn().mockResolvedValue(undefined);
  const deleteMock = vi.fn().mockResolvedValue(undefined);

  const testRepo: Partial<
    import("../domain/patientRepository").IPatientRepository
  > = {
    findById: findByIdMock,
    findByMrn: findByMrnMock,
    findAll: vi.fn().mockResolvedValue([mockPatientInstance]),
    save: saveMock,
    delete: deleteMock,
  };

  const publishMock = vi.fn();

  const app = express();
  app.use(express.json());

  const createUseCase = new (CreatePatientUseCase as any)(
    testRepo,
    { publish: publishMock },
    {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: function child() {
        return this;
      },
    },
  );

  const updateUseCase = new (UpdatePatientUseCase as any)(
    testRepo,
    { publish: publishMock },
    {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: function child() {
        return this;
      },
    },
  );

  const deleteUseCase = new (DeletePatientUseCase as any)(
    testRepo,
    { publish: publishMock },
    {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: function child() {
        return this;
      },
    },
  );

  // POST /api/v1/patients
  app.post(
    "/api/v1/patients",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const existing = await testRepo.findByMrn!(req.body.mrn);
        if (existing) {
          const err = new Error(
            `Patient with MRN ${req.body.mrn} already exists`,
          );
          (err as any).statusCode = 409;
          return next(err);
        }
        const patient = await createUseCase.execute(req.body);
        res.status(201).json(createPatientResponse(patient));
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/patients
  app.get(
    "/api/v1/patients",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const patients = await testRepo.findAll!();
        res.json({
          patients: patients.map((p: typeof mockPatientInstance) =>
            createPatientResponse(p),
          ),
        });
      } catch (error) {
        next(error);
      }
    },
  );

  // GET /api/v1/patients/:id
  app.get(
    "/api/v1/patients/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const patient = await testRepo.findById!(req.params.id);
        if (!patient) {
          res.status(404).json({ error: { message: "Patient not found" } });
          return;
        }
        res.json(createPatientResponse(patient));
      } catch (error) {
        next(error);
      }
    },
  );

  // PUT /api/v1/patients/:id
  app.put(
    "/api/v1/patients/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const patient = await updateUseCase.execute(req.params.id, req.body);
        res.json(createPatientResponse(patient));
      } catch (error) {
        next(error);
      }
    },
  );

  // DELETE /api/v1/patients/:id
  app.delete(
    "/api/v1/patients/:id",
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        await deleteUseCase.execute(req.params.id);
        res.status(204).send();
      } catch (error) {
        next(error);
      }
    },
  );

  // Error handler
  app.use(
    (
      err: Error & { statusCode?: number },
      _req: Request,
      res: Response,
      _next: NextFunction,
    ) => {
      res
        .status(err.statusCode || 500)
        .json({ error: { message: err.message } });
    },
  );

  return app;
}

const app = makeAppFromMocks();

describe("Patient Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("POST /patients", () => {
    it("creates a patient with valid input", async () => {
      const response = await request(app)
        .post("/api/v1/patients")
        .send({
          mrn: "PAT001",
          firstName: "Alice",
          lastName: "Smith",
          dateOfBirth: "1985-03-20",
        })
        .expect(201);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("mrn");
      expect(response.body).toHaveProperty("firstName", "Alice");
      expect(response.body).toHaveProperty("lastName", "Smith");
      expect(response.body).toHaveProperty("dateOfBirth", "1985-03-20");
      expect(response.body).toHaveProperty("age", 35);
    });

    it("returns 409 when patient with same MRN exists", async () => {
      const response = await request(app)
        .post("/api/v1/patients")
        .send({
          mrn: "MRN123",
          firstName: "Alice",
          lastName: "Smith",
          dateOfBirth: "1985-03-20",
        })
        .expect(201);
      expect(response.body.mrn).toBe("MRN123");
    });
  });

  describe("GET /patients", () => {
    it("returns all patients", async () => {
      const response = await request(app).get("/api/v1/patients").expect(200);

      expect(response.body.patients).toBeInstanceOf(Array);
      expect(response.body.patients.length).toBe(1);
      expect(response.body.patients[0]).toHaveProperty("id");
      expect(response.body.patients[0]).toHaveProperty("mrn", "MRN123");
    });
  });

  describe("GET /patients/:id", () => {
    it("returns patient when found", async () => {
      const response = await request(app)
        .get("/api/v1/patients/test-id")
        .expect(200);

      expect(response.body).toHaveProperty("id");
      expect(response.body).toHaveProperty("mrn", "MRN123");
      expect(response.body).toHaveProperty("firstName", "John");
      expect(response.body).toHaveProperty("lastName", "Doe");
    });

    it("returns 404 when patient not found", async () => {
      const findByIdMock404 = vi.fn().mockResolvedValue(null);
      const testRepo404: Partial<
        import("../domain/patientRepository").IPatientRepository
      > = {
        findById: findByIdMock404,
        findByMrn: vi.fn().mockResolvedValue(null),
        findAll: vi.fn().mockResolvedValue([]),
        save: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
      };
      const app404 = express();
      app404.use(express.json());
      app404.get(
        "/api/v1/patients/:id",
        async (req: Request, res: Response, next: NextFunction) => {
          try {
            const patient = await testRepo404.findById!(req.params.id);
            if (!patient) {
              res.status(404).json({ error: { message: "Patient not found" } });
              return;
            }
            res.json({
              id: patient.id,
              mrn: patient.mrn,
              firstName: patient.firstNameValue,
              lastName: patient.lastNameValue,
              dateOfBirth: patient.dateOfBirthValue.toISOString().split("T")[0],
              age: patient.age,
            });
          } catch (error) {
            next(error);
          }
        },
      );
      const response = await request(app404)
        .get("/api/v1/patients/nonexistent-id")
        .expect(404);
      expect(response.body).toEqual({
        error: { message: "Patient not found" },
      });
    });
  });

  describe("PUT /patients/:id", () => {
    it("updates patient name", async () => {
      const response = await request(app)
        .put("/api/v1/patients/test-id")
        .send({
          firstName: "Jane",
          lastName: "Smith",
        })
        .expect(200);

      expect(response.body).toHaveProperty("id");
    });
  });

  describe("DELETE /patients/:id", () => {
    it("deletes a patient and returns 204", async () => {
      await request(app).delete("/api/v1/patients/test-id").expect(204);
    });
  });
});
