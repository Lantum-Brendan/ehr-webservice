import { Request, Response, NextFunction } from "express";
import { logger } from "../../shared/logger/index.js";
import { config } from "../config/index.js";

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

  // Capture request start time
  const startTime = Date.now();

  // Log the request
  const auditLog = {
    timestamp: new Date().toISOString(),
    requestId: req.id,
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip,
    userAgent: req.get("user-agent"),
    // Extract user information from auth token if available
    userId: req.userId,
    patientId: req.params?.id || req.body?.patientId,
    resourceType: req.body?.resourceType,
    action: req.method,
  };

  // Log audit event at info level
  logger.info(auditLog, "AUDIT: Request received");

  // Intercept response to log completion
  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;

    const completionLog = {
      timestamp: new Date().toISOString(),
      requestId: req.id,
      statusCode: res.statusCode,
      durationMs: duration,
      success: res.statusCode >= 200 && res.statusCode < 300,
    };

    if (res.statusCode >= 400) {
      logger.warn(completionLog, "AUDIT: Request completed with error");
    } else {
      logger.info(completionLog, "AUDIT: Request completed successfully");
    }

    // Restore original send
    res.send = originalSend;
    return originalSend.apply(res, [body]);
  };

  next();
};
