import { Request, Response, NextFunction } from "express";
import { ForbiddenError } from "../errors/appError.js";

/**
 * Middleware that verifies patient consent for PHI access
 * This is a simplified version - in production, integrate with consent management system
 */
export const requirePatientConsent = (
  req: Request,
  _res: Response,
  next: NextFunction,
): void => {
  const patientId = req.params.id || req.body.patientId;

  if (!patientId) {
    next();
    return;
  }

  // Check if user has consent to access this patient's data
  // In production, this would query a consent management database
  const hasConsent = checkConsent(req.user, patientId);

  if (!hasConsent) {
    throw new ForbiddenError(
      "No valid patient consent found for this data access",
    );
  }

  next();
};

/**
 * Simplified consent check - replace with real consent verification
 */
function checkConsent(
  user: { id: string; roles: string[] } | undefined,
  patientId: string,
): boolean {
  if (!user) return false;

  // Admins and the patient themselves always have access
  if (user.roles.includes("admin")) return true;
  if (user.id === patientId) return true;

  // Clinicians need active consent (would check consent management system)
  if (user.roles.includes("clinician")) {
    // TODO: Query consent management system
    return true; // Placeholder
  }

  return false;
}
