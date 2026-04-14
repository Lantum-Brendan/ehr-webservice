import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextFunction, Request, Response } from "express";

vi.mock("@core/utils/dateUtils.js", () => ({
  calculateAge: vi.fn(() => 35),
  isMinor: vi.fn(() => false),
}));

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
    patient: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      upsert: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { patientRouter } = await import("./patientRouter.js");

const PATIENT_ID = "11111111-1111-1111-1111-111111111111";
const OTHER_PATIENT_ID = "22222222-2222-2222-2222-222222222222";

function makePatientRecord(id: string) {
  return {
    id,
    mrn: "MRN123",
    firstName: "John",
    lastName: "Doe",
    dateOfBirth: new Date("1990-06-15T00:00:00.000Z"),
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
  const layer = patientRouter.stack.find(
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

  return { req, resState, error: capturedError };
}

describe("patientRouter ownership guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows patient users to read their own record using req.user.id", async () => {
    (prisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatientRecord(PATIENT_ID),
    );

    const result = await invokeRoute("get", "/:id", {
      params: { id: PATIENT_ID },
      headers: {
        "x-user-id": PATIENT_ID,
        "x-user-roles": "patient",
      },
    });

    expect(result.error).toBeUndefined();
    expect(prisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: PATIENT_ID },
    });
    expect(result.resState.body).toMatchObject({
      id: PATIENT_ID,
      mrn: "MRN123",
      firstName: "John",
      lastName: "Doe",
    });
  });

  it("blocks patient users from reading another patient's record", async () => {
    const result = await invokeRoute("get", "/:id", {
      params: { id: OTHER_PATIENT_ID },
      headers: {
        "x-user-id": PATIENT_ID,
        "x-user-roles": "patient",
      },
    });

    expect(result.error).toMatchObject({
      statusCode: 403,
      message: "Cannot access other patient's data",
    });
    expect(prisma.patient.findUnique).not.toHaveBeenCalled();
  });

  it("allows billing users to read patient records without ownership checks", async () => {
    (prisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue(
      makePatientRecord(OTHER_PATIENT_ID),
    );

    const result = await invokeRoute("get", "/:id", {
      params: { id: OTHER_PATIENT_ID },
      headers: {
        "x-user-id": "billing-user-1",
        "x-user-roles": "billing",
      },
    });

    expect(result.error).toBeUndefined();
    expect(prisma.patient.findUnique).toHaveBeenCalledWith({
      where: { id: OTHER_PATIENT_ID },
    });
    expect(result.resState.body).toMatchObject({
      id: OTHER_PATIENT_ID,
      mrn: "MRN123",
    });
  });
});
