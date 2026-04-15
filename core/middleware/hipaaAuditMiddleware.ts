import { Request, Response, NextFunction } from "express";
import { prisma } from "@infrastructure/database/prisma.client.js";
import { config } from "@core/config/index.js";

const SENSITIVE_FIELDS = [
  "ssn",
  "social",
  "dateofbirth",
  "dob",
  "address",
  "phone",
  "email",
  "password",
  "token",
  "amount",
  "card",
  "account",
];

function sanitizeData(data: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    const keyLower = key.toLowerCase();
    if (SENSITIVE_FIELDS.some((s) => keyLower.includes(s))) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "object" && value !== null) {
      sanitized[key] = sanitizeData(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

export const hipaaAuditMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  if (!config.audit.enabled) {
    next();
    return;
  }

  const startTime = Date.now();
  const isWriteAction = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);
  const isReadAction = req.method === "GET";

  if (!isWriteAction && !isReadAction) {
    next();
    return;
  }

  const originalSend = res.send;
  res.send = function (body) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const isSuccess = statusCode >= 200 && statusCode < 400;

    if (isSuccess) {
      const resourceMatch = req.path.match(/\/api\/v1\/(\w+)/);
      const resourceType = resourceMatch ? resourceMatch[1] : "unknown";

      const patientId =
        req.params.patientId ||
        req.params.id ||
        ((req.body as Record<string, unknown>)?.patientId as string) ||
        undefined;

      const details = sanitizeData({
        method: req.method,
        path: req.path,
        query: req.query,
        params: req.params,
        body: isWriteAction ? req.body : undefined,
        statusCode,
        durationMs: duration,
      });

      prisma.auditLog
        .create({
          data: {
            userId: (req as Record<string, unknown>)?.userId as
              | string
              | undefined,
            userEmail: (req as Record<string, unknown>)?.userEmail as
              | string
              | undefined,
            patientId,
            resourceType,
            resourceId: req.params?.id ?? req.body?.id ?? "unknown",
            action: req.method,
            ipAddress: req.ip ?? undefined,
            userAgent: req.get("user-agent") ?? undefined,
            details,
          },
        })
        .catch((err) => console.error("Audit log error:", err));
    }

    res.send = originalSend;
    return originalSend.apply(res, [body]);
  };

  next();
};
