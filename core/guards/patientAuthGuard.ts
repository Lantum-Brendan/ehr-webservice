import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors/appError.js";

export interface PatientAuthorizationOptions {
  requireOwnership?: boolean;
}

export const authorizePatientAccess = (
  options: PatientAuthorizationOptions = {},
) => {
  return async (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw new ForbiddenError("Authentication required");
      }

      const user = req.user;
      const isPrivilegedUser = user.roles.some(
        (r) => r === "clinician" || r === "admin" || r === "billing",
      );

      if (isPrivilegedUser) {
        next();
        return;
      }

      const isPatientUser = user.roles.includes("patient");
      if (!isPatientUser) {
        throw new ForbiddenError("Insufficient permissions");
      }

      if (!options.requireOwnership) {
        next();
        return;
      }

      const actorPatientId = user.patientId ?? user.id;
      const requestedPatientId =
        req.params.patientId || req.params.id || req.body?.patientId;

      if (!requestedPatientId || requestedPatientId !== actorPatientId) {
        throw new ForbiddenError("Cannot access other patient's data");
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
