import { describe, it, expect, vi, beforeEach } from "vitest";
import { errorHandler } from "./error-handler.js";
import { NotFoundError, ForbiddenError, ConflictError } from "./appError.js";
import { Request, Response } from "express";
import { ZodError } from "zod";

vi.mock("../../shared/logger/index.js", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() })),
  },
}));

function makeRes() {
  const res = { statusCode: 200, body: undefined as unknown };
  (res as any).status = (n: number) => {
    res.statusCode = n;
    return res as any;
  };
  (res as any).json = (b: unknown) => {
    res.body = b;
    return res as any;
  };
  return res as unknown as Response;
}

describe("errorHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 404 for NotFoundError", () => {
    const res = makeRes();
    const err = new NotFoundError("Patient not found");
    errorHandler(
      err,
      { path: "/api/v1/patients/x", method: "GET", id: "req-1" } as any,
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(404);
    expect((res as any).body.error.code).toBe("NOT_FOUND");
    expect((res as any).body.error.message).toBe("Patient not found");
  });

  it("returns 403 for ForbiddenError", () => {
    const res = makeRes();
    const err = new ForbiddenError("Access denied");
    errorHandler(
      err,
      { path: "/", method: "GET", id: "r" } as any,
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(403);
    expect((res as any).body.error.code).toBe("FORBIDDEN");
  });

  it("returns 500 for unknown errors and does not leak message", () => {
    const res = makeRes();
    errorHandler(
      new Error("DB connection refused"),
      { path: "/", method: "GET", id: "r" } as any,
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(500);
    expect((res as any).body.error.message).toBe("Something went wrong");
  });

  it("returns 422 for Zod validation error", () => {
    const res = makeRes();
    const zodErr = new ZodError([
      {
        code: "invalid_type",
        path: ["name"],
        message: "Expected string",
        params: {},
      },
    ]);
    errorHandler(
      zodErr,
      { path: "/", method: "GET", id: "r" } as any,
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(422);
    expect((res as any).body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for generic Error with statusCode", () => {
    const res = makeRes();
    const err = new Error("Bad request");
    (err as any).statusCode = 400;
    errorHandler(
      err,
      { path: "/", method: "GET", id: "r" } as any,
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(400);
  });

  it("returns 409 for conflict errors", () => {
    const res = makeRes();
    const err = new ConflictError("Resource already exists");
    errorHandler(
      err,
      { path: "/", method: "POST", id: "r" } as any,
      res,
      vi.fn(),
    );
    expect(res.statusCode).toBe(409);
  });
});
