import { Redis } from "ioredis";
import { logger } from "../../shared/logger/index.js";

/**
 * Redis client singleton
 * Used for caching, rate limiting, session storage, and BullMQ queue backing
 */

let redisClient: Redis | null = null;

export function initializeRedis(): Redis | null {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    logger.warn("REDIS_URL not set, Redis client disabled");
    return null;
  }

  if (!redisClient) {
    // @ts-expect-error - ioredis options typing can be complex
    redisClient = new Redis(redisUrl, {
      // Connection options
      retryStrategy: (times) => {
        // reconnect after
        return Math.min(times * 50, 2000);
      },
      maxRetriesPerRequest: 3,
      lazyConnect: true,
      // Performance
      keepAlive: true,
      diagnosticsLog: process.env.NODE_ENV === "development",
    });

    redisClient.on("connect", () => {
      logger.info("Redis client connected");
    });

    redisClient.on("error", (error) => {
      logger.error({ error }, "Redis client error");
    });

    redisClient.on("close", () => {
      logger.info("Redis client connection closed");
    });

    redisClient.on("reconnecting", (attempt: number) => {
      logger.warn({ attempt }, "Redis client reconnecting");
    });
  }

  return redisClient;
}

export function getRedis(): Redis | null {
  return redisClient;
}

export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info("Redis client disconnected");
  }
}
