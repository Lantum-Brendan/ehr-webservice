import { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/logger/index.js";
import { config } from "../config/index.js";

const BILLING_PATHS = ["/invoices", "/payments", "/line-items"];
const PATIENT_PATHS = ["/patients"];
const APPOINTMENT_PATHS = ["/appointments", "/schedules"];
const ENCOUNTER_PATHS = ["/encounters"];
const FHIR_PATHS = ["/fhir"];

function isBillingOperation(path: string): boolean {
  return BILLING_PATHS.some((p) => path.includes(p));
}

function isPatientOperation(path: string): boolean {
  return PATIENT_PATHS.some((p) => path.includes(p));
}

function isAppointmentOperation(path: string): boolean {
  return APPOINTMENT_PATHS.some((p) => path.includes(p));
}

function isEncounterOperation(path: string): boolean {
  return ENCOUNTER_PATHS.some((p) => path.includes(p));
}

function isFhirOperation(path: string): boolean {
  return FHIR_PATHS.some((p) => path.includes(p));
}

function sanitizeForAudit(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const sensitive = ["amount", "reference", "card", "account", "ssn", "credit"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    const keyLower = key.toLowerCase();
    if (sensitive.some((s) => keyLower.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeForAudit(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

/**
 * HIPAA audit middleware - logs all PHI access and modifications
 * This middleware should run early in the chain to capture all requests
 * that might access Protected Health Information
 */
export const auditMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  if (!config.audit.enabled) {
    next();
    return;
  }

  const startTime = Date.now();
  const isBilling = isBillingOperation(req.path);
  const isPatient = isPatientOperation(req.path);
  const isAppointment = isAppointmentOperation(req.path);
  const isEncounter = isEncounterOperation(req.path);
  const isFhir = isFhirOperation(req.path);
  const actorPatientId =
    req.user?.patientId ||
    (req.user?.roles?.includes("patient") ? req.user?.id : undefined);
  const patientId =
    req.params?.patientId ||
    (isPatient ? req.params?.id : undefined) ||
    req.body?.patientId ||
    (isAppointment || isEncounter ? actorPatientId : undefined);

  const auditLog: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    path: req.path,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    userId: req.userId,
    patientId,
    action: req.method,
  };

  if (isBilling) {
    auditLog.requestBody = sanitizeForAudit(
      req.body as Record<string, unknown>,
    );
    auditLog.resourceType = "billing";
  } else if (isPatient) {
    auditLog.resourceType = "patient";
  } else if (isAppointment) {
    auditLog.query = req.query;
    auditLog.resourceType = "appointment";
  } else if (isEncounter) {
    auditLog.query = req.query;
    auditLog.resourceType = "encounter";
  } else if (isFhir) {
    auditLog.query = req.query;
    auditLog.resourceType = "fhir";
  } else {
    auditLog.query = req.query;
    auditLog.resourceType = req.body?.resourceType;
  }

  logger.info(auditLog, "AUDIT: Request received");

  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;

    const completionLog: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      statusCode: res.statusCode,
      durationMs: duration,
      success: res.statusCode >= 200 && res.statusCode < 300,
    };

    if (isBilling || isPatient || isAppointment || isEncounter || isFhir) {
      completionLog.resourceType = isBilling
        ? "billing"
        : isPatient
          ? "patient"
          : isAppointment
            ? "appointment"
            : isEncounter
              ? "encounter"
              : "fhir";
      completionLog.patientId = patientId;
    }

    if (res.statusCode >= 400) {
      logger.warn(completionLog, "AUDIT: Request completed with error");
    } else {
      logger.info(completionLog, "AUDIT: Request completed successfully");
    }

    res.send = originalSend;
    return originalSend.apply(res, [body]);
  };

  next();
};
