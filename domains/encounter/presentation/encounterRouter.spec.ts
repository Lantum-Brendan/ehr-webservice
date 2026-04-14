import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextFunction, Request, Response } from "express";

vi.mock("@core/guards/roleGuard.js", () => ({
  requireRole:
    () => (req: Request, _res: Response, next: NextFunction): void => {
      const userId = req.header("x-user-id") ?? "";
      const rolesHeader = req.header("x-user-roles") ?? "";
      const patientIdHeader = req.header("x-patient-id") ?? undefined;
      req.user = {
        id: userId,
        roles: rolesHeader.split(",").filter(Boolean),
        patientId: patientIdHeader,
      };
      next();
    },
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
    encounter: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
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
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { encounterRouter } = await import("./encounterRouter.js");

const OWNER_PATIENT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PATIENT_ID = "22222222-2222-2222-2222-222222222222";
const ENCOUNTER_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

function makeEncounterRecord() {
  return {
    id: ENCOUNTER_ID,
    patientId: OWNER_PATIENT_ID,
    appointmentId: "appointment-1",
    providerId: "provider-1",
    encounterType: "outpatient",
    startTime: new Date("2099-01-01T10:00:00.000Z"),
    endTime: null,
    status: "arrived",
    createdAt: new Date("2098-12-30T10:00:00.000Z"),
  };
}

async function invokeRoute(
  method: "get",
  path: string,
  options: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    body?: unknown;
    query?: Record<string, unknown>;
  } = {},
) {
  const layer = encounterRouter.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method],
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  const req = {
    body: options.body ?? {},
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

  return { resState, error: capturedError };
}

describe("encounterRouter ownership guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows patient users to read their own encounter via patientId claim", async () => {
    (prisma.encounter.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValue(makeEncounterRecord());

    const result = await invokeRoute("get", "/:id", {
      params: { id: ENCOUNTER_ID },
      headers: {
        "x-user-id": "auth-user-1",
        "x-user-roles": "patient",
        "x-patient-id": OWNER_PATIENT_ID,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.resState.statusCode).toBe(200);
    expect(result.resState.body).toMatchObject({
      id: ENCOUNTER_ID,
      patientId: OWNER_PATIENT_ID,
    });
  });

  it("blocks patient users from reading another patient's encounter", async () => {
    (prisma.encounter.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValue(makeEncounterRecord());

    const result = await invokeRoute("get", "/:id", {
      params: { id: ENCOUNTER_ID },
      headers: {
        "x-user-id": "auth-user-1",
        "x-user-roles": "patient",
        "x-patient-id": OTHER_PATIENT_ID,
      },
    });

    expect(result.error).toMatchObject({
      statusCode: 403,
      message: "Cannot access this encounter",
    });
  });

  it("allows patients to list their own encounters", async () => {
    (prisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: OWNER_PATIENT_ID,
      mrn: "MRN123",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: new Date("1990-06-15T00:00:00.000Z"),
    });
    (prisma.encounter.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValue([makeEncounterRecord()]);

    const result = await invokeRoute("get", "/patient/:patientId", {
      params: { patientId: OWNER_PATIENT_ID },
      headers: {
        "x-user-id": "auth-user-1",
        "x-user-roles": "patient",
        "x-patient-id": OWNER_PATIENT_ID,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.resState.statusCode).toBe(200);
    expect(result.resState.body).toMatchObject({
      encounters: [
        expect.objectContaining({
          id: ENCOUNTER_ID,
        }),
      ],
    });
  });
});
