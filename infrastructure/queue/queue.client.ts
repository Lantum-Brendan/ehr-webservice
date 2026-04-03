import { Queue, Worker, Job, JobsOptions } from "bullmq";
import { Redis } from "ioredis";
import { getRedis } from "../cache/redis.client.js";
import { logger } from "../../shared/logger/index.js";

/**
 * BullMQ queue system for async jobs
 * Used for: lab orders, notifications, billing processing, etc.
 */

// Connection configuration
let connection: Redis | null = null;

function getConnection(): Redis {
  if (!connection) {
    connection = getRedis();
    if (!connection) {
      throw new Error("Redis not initialized. Cannot create BullMQ queues.");
    }
  }
  return connection;
}

// Queue names
export const QUEUE_NAMES = {
  LAB_ORDERS: "lab-orders",
  NOTIFICATIONS: "notifications",
  BILLING: "billing-processor",
  FHIR_SYNC: "fhir-sync",
  REPORT_GENERATION: "report-generation",
} as const;

/**
 * Factory function to create a BullMQ queue
 */
export function createQueue(
  name: string,
  options?: { defaultJobOptions?: JobsOptions },
) {
  try {
    const queue = new Queue(name, {
      connection: getConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: {
          count: 1000,
          age: 24 * 60 * 60 * 1000, // 24 hours
        },
        removeOnFail: {
          count: 1000,
          age: 24 * 60 * 60 * 1000,
        },
        ...options?.defaultJobOptions,
      },
    });

    logger.info({ queueName: name }, "BullMQ queue created");
    return queue;
  } catch (error) {
    logger.error({ error, queueName: name }, "Failed to create queue");
    throw error;
  }
}

// Pre-configured queues
export const labOrderQueue = createQueue(QUEUE_NAMES.LAB_ORDERS);
export const notificationQueue = createQueue(QUEUE_NAMES.NOTIFICATIONS);
export const billingQueue = createQueue(QUEUE_NAMES.BILLING);
export const fhirSyncQueue = createQueue(QUEUE_NAMES.FHIR_SYNC);

/**
 * Create a worker to process jobs from a queue
 */
export function createWorker(
  queueName: string,
  processor: (job: Job) => Promise<unknown>,
  concurrency: number = 5,
): Worker {
  const worker = new Worker(
    queueName,
    async (job: Job) => {
      logger.info(
        { jobId: job.id, jobName: job.name, data: job.data },
        "Processing job",
      );

      try {
        const result = await processor(job);
        logger.info(
          { jobId: job.id, jobName: job.name },
          "Job completed successfully",
        );
        return result;
      } catch (error) {
        logger.error({ jobId: job.id, jobName: job.name, error }, "Job failed");
        throw error;
      }
    },
    {
      connection: getConnection(),
      concurrency,
      autorun: false, // Call worker.run() after adding event handlers
    },
  );

  worker.on("completed", (job: Job | undefined) => {
    if (job) {
      logger.debug(
        { jobId: job.id, jobName: job.name, returnvalue: job.returnvalue },
        "Job completed",
      );
    }
  });

  worker.on("failed", (job: Job | undefined, error: Error) => {
    if (job) {
      logger.error(
        { jobId: job.id, jobName: job.name, error },
        "Job failed permanently after all retries",
      );
    }
  });

  worker.on("error", (error: Error) => {
    logger.error({ error }, "Worker error");
  });

  return worker;
}
