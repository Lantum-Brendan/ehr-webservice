import { pino } from "pino";
import { config } from "../../core/config/index.js";

// Configure logger based on environment
const logger = pino(
  {
    level: config.env === "production" ? "info" : "debug",
    transport:
      config.env === "production"
        ? {
            target: "pino-pretty",
            options: {
              translateTime: "HH:MM:ss Z",
              ignore: "pid,hostname",
            },
          }
        : undefined,
    // Base metadata for all log entries
    base: {
      env: config.env,
      service: "ehr-webservice",
    },
    // Redact sensitive fields in production
    ...(config.env === "production" && {
      redact: [
        "req.headers.authorization",
        "req.body.password",
        "req.body.ssn",
      ],
    }),
    // Serializers for complex objects
    serializers: {
      req: (req: any) => ({
        method: req.method,
        url: req.url,
        version: req.httpVersion,
        headers: {
          host: req.headers.host,
          "user-agent": req.headers["user-agent"],
        },
      }),
      res: (res: any) => ({
        statusCode: res.statusCode,
      }),
    },
  },
  // Child logger for request-scoped logging
  pino.destination(config.env === "production" ? 1 : 2), // 1=stdout, 2=stderr
);

export { logger };
export type Logger = typeof logger;
