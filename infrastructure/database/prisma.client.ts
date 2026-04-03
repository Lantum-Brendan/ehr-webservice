import { PrismaClient } from "@prisma/client";
import { logger } from "../../shared/logger/index.js";

/**
 * Prisma database client singleton
 * Used for all PostgreSQL operations
 */
export const prisma = new PrismaClient({
  log: [
    { emit: "event", level: "query" },
    { emit: "event", level: "error" },
    { emit: "event", level: "info" },
    { emit: "event", level: "warn" },
  ],
});

// Log Prisma errors
prisma.$on("error", (e: unknown) => {
  logger.error({ error: e }, "Prisma error");
});

// Log queries in development
if (process.env.NODE_ENV !== "production") {
  prisma.$on(
    "query",
    (e: { query: string; params: string; duration: number }) => {
      logger.debug(
        {
          query: e.query,
          params: e.params,
          duration: `${e.duration}ms`,
        },
        "Database query",
      );
    },
  );
}

logger.info("Prisma client initialized");
