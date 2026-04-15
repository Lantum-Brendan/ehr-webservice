import { describe, it, expect, vi, beforeEach } from "vitest";
import { Request, Response, NextFunction } from "express";
import { requireRole, UserInfo } from "./roleGuard.js";

const mockNext = vi.fn();

function makeReq(user?: UserInfo) {
  return { user } as unknown as Request;
}
const res = {} as unknown as Response;

describe("requireRole", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws Error for invalid role name in allowedRoles", () => {
    expect(() =>
      requireRole("superadmin" as any)(makeReq(), res, mockNext),
    ).toThrow("Invalid role: superadmin");
  });

  it("throws ForbiddenError when req.user is undefined", () => {
    const reqWithoutUser = { user: undefined } as unknown as Request;
    expect(() =>
      requireRole("clinician")(reqWithoutUser, res, mockNext),
    ).toThrow("Authentication required");
    expect(mockNext).not.toHaveBeenCalled();
  });

  it("throws ForbiddenError when user has no roles", () => {
    const req = { user: { id: "u1", roles: [] } } as unknown as Request;
    expect(() => requireRole("admin")(req, res, mockNext)).toThrow(
      "Insufficient permissions",
    );
  });

  it("throws ForbiddenError when user has no matching role", () => {
    const req = {
      user: { id: "u1", roles: ["patient"] },
    } as unknown as Request;
    expect(() => requireRole("admin")(req, res, mockNext)).toThrow(
      "Insufficient permissions",
    );
  });

  it("calls next() when user has the required role", () => {
    const req = {
      user: { id: "u1", roles: ["clinician"] },
    } as unknown as Request;
    requireRole("clinician")(req, res, mockNext);
    expect(mockNext).toHaveBeenCalledWith();
  });

  it("calls next() when user has one of multiple allowed roles", () => {
    const req = {
      user: { id: "u1", roles: ["clinician"] },
    } as unknown as Request;
    requireRole("admin", "clinician")(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows billing role on billing-permitted routes", () => {
    const req = {
      user: { id: "u1", roles: ["billing"] },
    } as unknown as Request;
    requireRole("clinician", "admin", "billing")(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });

  it("allows admin role to access clinician routes", () => {
    const req = { user: { id: "u1", roles: ["admin"] } } as unknown as Request;
    requireRole("clinician", "admin")(req, res, mockNext);
    expect(mockNext).toHaveBeenCalled();
  });
});
