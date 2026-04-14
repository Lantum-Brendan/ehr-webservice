import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextFunction, Request, Response } from "express";

vi.mock("@core/guards/roleGuard.js", () => ({
  requireRole:
    () => (req: Request, _res: Response, next: NextFunction): void => {
      const userId = req.header("x-user-id") ?? "";
      const rolesHeader = req.header("x-user-roles") ?? "";
      req.user = {
        id: userId,
        roles: rolesHeader.split(",").filter(Boolean),
      };
      next();
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
    appointment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
    encounter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { fhirGatewayRouter } = await import("./fhirGatewayRouter.js");

async function invokeRoute(
  method: "get",
  path: string,
  options: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    query?: Record<string, unknown>;
  } = {},
) {
  const layer = fhirGatewayRouter.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method],
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  const req = {
    body: {},
    params: options.params ?? {},
    query: options.query ?? {},
    headers: options.headers ?? {},
    user: undefined,
    header(name: string) {
      return this.headers[name.toLowerCase()] ?? this.headers[name];
    },
  } as unknown as Request;

  const resState = {
    statusCode: 200,
    body: undefined as unknown,
  };

  const res = {
    status(code: number) {
      resState.statusCode = code;
      return this;
    },
    json(payload: unknown) {
      resState.body = payload;
      return this;
    },
  } as unknown as Response;

  let capturedError: unknown;

  for (const routeLayer of layer.route.stack) {
    await new Promise<void>((resolve) => {
      const next = (error?: unknown): void => {
        if (error) {
          capturedError = error;
        }
        resolve();
      };

      Promise.resolve(routeLayer.handle(req, res, next))
        .then(() => resolve())
        .catch((error) => {
          capturedError = error;
          resolve();
        });
    });

    if (capturedError || resState.body !== undefined) {
      break;
    }
  }

  if (capturedError) {
    const errorLayer = fhirGatewayRouter.stack.find(
      (entry: any) => entry.handle?.length === 4,
    );
    if (!errorLayer) {
      throw capturedError;
    }

    await new Promise<void>((resolve) => {
      Promise.resolve(errorLayer.handle(capturedError, req, res, () => resolve()))
        .then(() => resolve())
        .catch(() => resolve());
    });
  }

  return { resState };
}

describe("fhirGatewayRouter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a capability statement", async () => {
    const result = await invokeRoute("get", "/metadata", {
      headers: {
        "x-user-id": "staff-1",
        "x-user-roles": "admin",
      },
    });

    expect(result.resState.statusCode).toBe(200);
    expect(result.resState.body).toMatchObject({
      resourceType: "CapabilityStatement",
      rest: [
        {
          resource: expect.arrayContaining([
            expect.objectContaining({ type: "Patient" }),
            expect.objectContaining({ type: "Appointment" }),
            expect.objectContaining({ type: "Encounter" }),
          ]),
        },
      ],
    });
  });

  it("returns a FHIR Patient resource", async () => {
    (prisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: "patient-1",
      mrn: "MRN123",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: new Date("1990-06-15T00:00:00.000Z"),
    });

    const result = await invokeRoute("get", "/Patient/:id", {
      params: { id: "patient-1" },
      headers: {
        "x-user-id": "staff-1",
        "x-user-roles": "admin",
      },
    });

    expect(result.resState.statusCode).toBe(200);
    expect(result.resState.body).toMatchObject({
      resourceType: "Patient",
      id: "patient-1",
      name: [
        {
          family: "Doe",
          given: ["Jane"],
        },
      ],
    });
  });

  it("returns a FHIR Encounter search bundle", async () => {
    (prisma.encounter.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([
      {
        id: "encounter-1",
        patientId: "patient-1",
        appointmentId: "appointment-1",
        providerId: "provider-1",
        encounterType: "outpatient",
        startTime: new Date("2099-01-01T10:00:00.000Z"),
        endTime: null,
        status: "arrived",
        createdAt: new Date("2098-12-30T10:00:00.000Z"),
      },
    ]);

    const result = await invokeRoute("get", "/Encounter", {
      query: { patient: "patient-1" },
      headers: {
        "x-user-id": "staff-1",
        "x-user-roles": "admin",
      },
    });

    expect(result.resState.statusCode).toBe(200);
    expect(result.resState.body).toMatchObject({
      resourceType: "Bundle",
      total: 1,
      entry: [
        {
          resource: {
            resourceType: "Encounter",
            id: "encounter-1",
            subject: { reference: "Patient/patient-1" },
          },
        },
      ],
    });
  });

  it("returns OperationOutcome for unsupported empty Appointment search", async () => {
    const result = await invokeRoute("get", "/Appointment", {
      headers: {
        "x-user-id": "staff-1",
        "x-user-roles": "admin",
      },
    });

    expect(result.resState.statusCode).toBe(400);
    expect(result.resState.body).toMatchObject({
      resourceType: "OperationOutcome",
      issue: [
        expect.objectContaining({
          diagnostics: "At least one Appointment search parameter is required",
        }),
      ],
    });
  });
});
