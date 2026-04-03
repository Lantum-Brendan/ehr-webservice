import { MongoClient, Db } from "mongodb";
import { logger } from "../../shared/logger/index.js";

/**
 * MongoDB client singleton
 * Used for flexible document storage (unstructured clinical notes, FHIR resources)
 */

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;

export async function initializeMongo(): Promise<void> {
  const mongoUrl = process.env.MONGODB_URL;

  if (!mongoUrl) {
    logger.warn("MONGODB_URL not set, MongoDB client disabled");
    return;
  }

  try {
    mongoClient = new MongoClient(mongoUrl, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    await mongoClient.connect();
    mongoDb = mongoClient.db(); // Uses database from connection string

    logger.info({ url: mongoUrl }, "MongoDB client connected successfully");
  } catch (error) {
    logger.error({ error }, "Failed to connect to MongoDB");
    throw error;
  }
}

export async function disconnectMongo(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    mongoDb = null;
    logger.info("MongoDB client disconnected");
  }
}

export function getMongoDb(): Db | null {
  return mongoDb;
}

export function getMongoClient(): MongoClient | null {
  return mongoClient;
}
