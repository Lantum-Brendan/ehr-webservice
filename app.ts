import express, { Express, Request, Response, NextFunction } from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";

// Core components (will create these next)
import { requestIdMiddleware } from "./core/middleware/requestIdMiddleware.js";
import { auditMiddleware } from "./core/middleware/auditMiddleware.js";
import { errorHandler } from "./core/errors/error-handler.js";
import { config } from "./core/config/index.js";

// Domain routers (will be created when implementing each domain)
// import { patientRouter } from './domains/patient/presentation/patientRouter.js';
// import { appointmentRouter } from './domains/appointment/presentation/appointmentRouter.js';
// import { encounterRouter } from './domains/encounter/presentation/encounterRouter.js';
import { clinicalNoteRouter } from "./domains/clinical-note/presentation/clinicalNoteRouter.js";
import { scheduleRouter } from "./domains/appointment/presentation/scheduleRouter.js";
import { billingRouter } from "./domains/billing/presentation/billingRouter.js";
import { patientRouter } from "./domains/patient/presentation/patientRouter.js";

export function createApp(): Express {
  const app = express();

  // Security hardening
  app.use(helmet());
  app.use(
    cors({
      origin: config.cors.origin,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: "1mb" }));
  app.use(express.urlencoded({ extended: true, limit: "1mb" }));
  app.disable("x-powered-by");

  // Rate limiting
  const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: "Too many requests from this IP, please try again later.",
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use("/api/", globalLimiter);

  // Request tracing
  app.use(requestIdMiddleware);

  // HIPAA audit trail on every request
  app.use(auditMiddleware);

  // Health check
  app.get("/health", (_req: Request, res: Response) => {
    res.status(200).json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  });

  // API versioning root
  app.use("/api/v1", (_req: Request, res: Response, next: NextFunction) => {
    res.locals.apiVersion = "v1";
    next();
  });

  // Domain routers - mount here when implemented
  // app.use('/api/v1/patients', patientRouter);
  // app.use('/api/v1/appointments', appointmentRouter);
  // app.use('/api/v1/encounters', encounterRouter);
  app.use("/api/v1/clinical-notes", clinicalNoteRouter);
  app.use("/api/v1/schedules", scheduleRouter);
  app.use("/api/v1/billing", billingRouter);
  app.use("/api/v1/patients", patientRouter);

  // Placeholder route
  app.get("/api/v1", (_req: Request, res: Response) => {
    res.json({
      message: "EHR Webservice API",
      version: "v1",
      status: "operational",
      endpoints: {
        health: "/health",
        // patients: '/api/v1/patients',
        // encounters: '/api/v1/encounters',
      },
    });
  });

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
