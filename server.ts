import { createApp } from "./app.js";
import { logger } from "./shared/logger/index.js";
import { config } from "./core/config/index.js";

// These will be initialized when implementing the infrastructure layer
// import { prisma } from './infrastructure/database/prisma.client.js';
// import { redis } from './infrastructure/cache/redis.client.js';

const app = createApp();
const PORT = config.server.port;
const HOST = config.server.host;

const server = app.listen(PORT, HOST, () => {
  logger.info(
    {
      host: HOST,
      port: PORT,
      env: config.env,
    },
    "Server started successfully",
  );
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown initiated");

  try {
    // Close HTTP server gracefully
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info("HTTP server closed");
        resolve();
      });
    });

    // TODO: Add infrastructure cleanup when implemented
    // await prisma.$disconnect();
    // await redis.quit();

    logger.info("Shutdown complete");
    process.exit(0);
  } catch (error) {
    logger.error({ error }, "Error during shutdown");
    process.exit(1);
  }
}

// Handle termination signals
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGQUIT", () => shutdown("SIGQUIT"));

// Handle uncaught exceptions
process.on("uncaughtException", (error: Error) => {
  logger.fatal({ error }, "Uncaught exception");
  process.exit(1);
});

// Handle unhandled promise rejections
process.on("unhandledRejection", (reason: unknown) => {
  logger.fatal({ reason }, "Unhandled promise rejection");
  process.exit(1);
});
