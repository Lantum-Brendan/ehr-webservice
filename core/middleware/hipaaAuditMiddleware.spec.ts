import { describe, it, expect, vi, beforeEach } from "vitest";
import { hipaaAuditMiddleware } from "./hipaaAuditMiddleware.js";

vi.mock("@infrastructure/database/prisma.client.js", () => ({
  prisma: {
    auditLog: {
      create: vi.fn().mockResolvedValue({ id: "audit-1" }),
    },
  },
}));

vi.mock("@core/config/index.js", () => ({
  config: {
    audit: { enabled: true },
  },
}));

describe("hipaaAuditMiddleware", () => {
  let mockReq: any;
  let mockRes: any;
  let mockNext: any;

  beforeEach(async () => {
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockClear();
    vi.mocked(prisma.auditLog.create).mockResolvedValue({ id: "audit-1" });

    mockReq = {
      method: "POST",
      path: "/api/v1/patients",
      query: {},
      params: {},
      body: {},
      ip: "127.0.0.1",
      get: vi.fn((header: string) => {
        if (header === "user-agent") return "test-agent";
        return undefined;
      }),
    };
    mockRes = {
      statusCode: 201,
      send: vi.fn((body) => mockRes),
    };
    mockNext = vi.fn();
  });

  it("does NOT create audit log when audit is disabled via config", async () => {
    const { config } = await import("@core/config/index.js");
    config.audit.enabled = false;

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
    config.audit.enabled = true;
  });

  it("creates audit log entry for POST (write action)", async () => {
    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);

    mockRes.send({ id: "patient-1" });

    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("creates audit log entry for GET (read action)", async () => {
    mockReq.method = "GET";
    mockReq.path = "/api/v1/patients";
    mockReq.body = {};

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);

    mockRes.send({ patients: [] });

    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    expect(prisma.auditLog.create).toHaveBeenCalled();
  });

  it("does NOT create audit log for 4xx responses", async () => {
    mockRes.statusCode = 400;

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);

    mockRes.send({ error: "Bad request" });

    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    expect(prisma.auditLog.create).not.toHaveBeenCalled();
  });

  it('redacts "dateofbirth" from audit log details', async () => {
    mockReq.body = { firstName: "John", dateOfBirth: "1990-01-01" };
    mockRes.statusCode = 201;

    let createCall: any;
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockImplementation((call: any) => {
      createCall = call;
      return Promise.resolve({ id: "audit-1" });
    });

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);
    mockRes.send({ id: "patient-1" });

    expect(createCall.data.details.body.dateOfBirth).toBe("[REDACTED]");
    expect(createCall.data.details.body.firstName).toBe("John");
  });

  it('redacts "amount" from audit log details', async () => {
    mockReq.body = { description: "Payment", amount: 100 };
    mockRes.statusCode = 200;

    let createCall: any;
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockImplementation((call: any) => {
      createCall = call;
      return Promise.resolve({ id: "audit-1" });
    });

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);
    mockRes.send({ success: true });

    expect(createCall.data.details.body.amount).toBe("[REDACTED]");
  });

  it('redacts "ssn" from audit log details', async () => {
    mockReq.body = { firstName: "Jane", ssn: "123-45-6789" };
    mockRes.statusCode = 201;

    let createCall: any;
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockImplementation((call: any) => {
      createCall = call;
      return Promise.resolve({ id: "audit-1" });
    });

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);
    mockRes.send({ id: "patient-1" });

    expect(createCall.data.details.body.ssn).toBe("[REDACTED]");
  });

  it('does NOT redact non-sensitive fields like "firstName"', async () => {
    mockReq.body = { firstName: "Alice", lastName: "Smith" };
    mockRes.statusCode = 201;

    let createCall: any;
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockImplementation((call: any) => {
      createCall = call;
      return Promise.resolve({ id: "audit-1" });
    });

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);
    mockRes.send({ id: "patient-1" });

    expect(createCall.data.details.body.firstName).toBe("Alice");
    expect(createCall.data.details.body.lastName).toBe("Smith");
  });

  it("logs patientId when present in request params", async () => {
    mockReq.params = { patientId: "patient-123" };
    mockReq.body = {};
    mockRes.statusCode = 200;

    let createCall: any;
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockImplementation((call: any) => {
      createCall = call;
      return Promise.resolve({ id: "audit-1" });
    });

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);
    mockRes.send({ success: true });

    expect(createCall.data.patientId).toBe("patient-123");
  });

  it("logs patientId from request body when not in params", async () => {
    mockReq.params = {};
    mockReq.body = { patientId: "patient-body-456" };
    mockRes.statusCode = 201;

    let createCall: any;
    const { prisma } =
      await import("@infrastructure/database/prisma.client.js");
    (prisma.auditLog.create as any).mockImplementation((call: any) => {
      createCall = call;
      return Promise.resolve({ id: "audit-1" });
    });

    await hipaaAuditMiddleware(mockReq, mockRes, mockNext);
    mockRes.send({ id: "patient-body-456" });

    expect(createCall.data.patientId).toBe("patient-body-456");
  });
});
