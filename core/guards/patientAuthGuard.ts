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
      const isClinicianOrAdmin = user.roles.some(
        (r) => r === "clinician" || r === "admin",
      );

      if (isClinicianOrAdmin) {
        next();
        return;
      }

      if (options.requireOwnership && user.patientId) {
        const requestedPatientId = req.params.id || req.body?.patientId;

        if (requestedPatientId && requestedPatientId !== user.patientId) {
          throw new ForbiddenError("Cannot access other patient's data");
        }

        if (requestedPatientId !== user.patientId) {
          throw new ForbiddenError("Cannot access this patient record");
        }
      }

      next();
    } catch (error) {
      next(error);
    }
  };
};
