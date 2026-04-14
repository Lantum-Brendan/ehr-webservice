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
    appointment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
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
    provider: {
      findUnique: vi.fn(),
    },
    appointmentType: {
      findUnique: vi.fn(),
    },
    location: {
      findUnique: vi.fn(),
    },
    clinicSettings: {
      findFirst: vi.fn(),
    },
  },
}));

const { prisma } = await import("@infrastructure/database/prisma.client.js");
const { appointmentRouter } = await import("./appointmentRouter.js");

const OWNER_PATIENT_ID = "patient-owner";

function makeAppointmentRecord() {
  return {
    id: "appointment-1",
    patientId: OWNER_PATIENT_ID,
    providerId: "provider-1",
    appointmentTypeId: "type-1",
    durationMinutes: 30,
    locationId: "location-1",
    scheduledStart: new Date("2099-01-01T10:00:00.000Z"),
    scheduledEnd: new Date("2099-01-01T10:30:00.000Z"),
    status: "SCHEDULED",
    reason: "Initial reason",
    notes: null,
    createdAt: new Date("2098-12-30T10:00:00.000Z"),
    updatedAt: new Date("2098-12-30T10:00:00.000Z"),
    cancelledAt: null,
    cancelledBy: null,
    cancelledReason: null,
  };
}

async function invokeRoute(
  method: "get" | "put",
  path: string,
  options: {
    headers?: Record<string, string>;
    params?: Record<string, string>;
    body?: unknown;
  } = {},
) {
  const layer = appointmentRouter.stack.find(
    (entry: any) => entry.route?.path === path && entry.route?.methods?.[method],
  );

  if (!layer) {
    throw new Error(`Route ${method.toUpperCase()} ${path} not found`);
  }

  const req = {
    body: options.body ?? {},
    params: options.params ?? {},
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

describe("appointmentRouter ownership guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("allows patient users to read their own appointment via patientId claim", async () => {
    (prisma.appointment.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValue(makeAppointmentRecord());

    const result = await invokeRoute("get", "/:id", {
      params: { id: "appointment-1" },
      headers: {
        "x-user-id": "auth-user-1",
        "x-user-roles": "patient",
        "x-patient-id": OWNER_PATIENT_ID,
      },
    });

    expect(result.error).toBeUndefined();
    expect(result.resState.statusCode).toBe(200);
    expect(result.resState.body).toMatchObject({
      id: "appointment-1",
      patientId: OWNER_PATIENT_ID,
    });
  });

  it("blocks patient users from reading another patient's appointment", async () => {
    (prisma.appointment.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValue(makeAppointmentRecord());

    const result = await invokeRoute("get", "/:id", {
      params: { id: "appointment-1" },
      headers: {
        "x-user-id": "patient-other",
        "x-user-roles": "patient",
      },
    });

    expect(result.error).toMatchObject({
      statusCode: 403,
      message: "Access denied",
    });
  });

  it("allows patients to list their own appointments via patientId claim", async () => {
    (prisma.patient.findUnique as ReturnType<typeof vi.fn>).mockResolvedValue({
      id: OWNER_PATIENT_ID,
      mrn: "MRN123",
      firstName: "Jane",
      lastName: "Doe",
      dateOfBirth: new Date("1990-06-15T00:00:00.000Z"),
    });
    (prisma.appointment.findMany as ReturnType<typeof vi.fn>)
      .mockResolvedValue([makeAppointmentRecord()]);

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
      appointments: [
        expect.objectContaining({
          id: "appointment-1",
        }),
      ],
    });
  });

  it("blocks patient users from cancelling another patient's appointment", async () => {
    (prisma.appointment.findUnique as ReturnType<typeof vi.fn>)
      .mockResolvedValue(makeAppointmentRecord());

    const result = await invokeRoute("put", "/:id/cancel", {
      params: { id: "appointment-1" },
      headers: {
        "x-user-id": "patient-other",
        "x-user-roles": "patient",
      },
      body: { reason: "Should not be allowed" },
    });

    expect(result.error).toMatchObject({
      statusCode: 403,
      message: "Access denied",
    });
    expect(prisma.appointment.findUnique).toHaveBeenCalledTimes(1);
    expect(prisma.appointment.upsert).not.toHaveBeenCalled();
  });
});
