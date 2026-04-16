import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors/appError.ts";

export interface UserInfo {
  id: string;
  roles: string[];
  // Add other user properties as needed (permissions, orgId, etc.)
}

declare global {
  namespace Express {
    interface Request {
      user?: UserInfo;
      userId?: string;
    }
  }
}

const ROLES = new Set([
  "patient",
  "clinician",
  "admin",
  "billing",
  "researcher",
  "reception",
]);

/**
 * Middleware that checks if the authenticated user has one of the required roles
 * Expects req.user to be populated by an authentication middleware
 */
export const requireRole = (...allowedRoles: string[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    // Validate allowed roles
    for (const role of allowedRoles) {
      if (!ROLES.has(role)) {
        throw new Error(`Invalid role: ${role}`);
      }
    }

    // Check if user is authenticated
    if (!req.user) {
      throw new ForbiddenError("Authentication required");
    }

    // Check if user has any of the required roles
    const hasRole = allowedRoles.some((role) =>
      req.user?.roles?.includes(role),
    );

    if (!hasRole) {
      throw new ForbiddenError(
        `Insufficient permissions. Required roles: ${allowedRoles.join(", ")}`,
      );
    }

    next();
  };
};
