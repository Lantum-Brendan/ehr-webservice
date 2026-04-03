import { z } from "zod";

// Environment-based configuration schema
const configSchema = z.object({
  env: z.enum(["development", "test", "production"]).default("development"),

  server: z.object({
    host: z.string().default("0.0.0.0"),
    port: z.number().default(3000),
  }),

  database: z.object({
    url: z.string().url(),
  }),

  redis: z.object({
    url: z.string().url().optional(),
    host: z.string().optional(),
    port: z.number().optional(),
  }),

  mongo: z.object({
    url: z.string().url().optional(),
  }),

  auth: z.object({
    jwtSecret: z.string().min(32),
    jwtExpiry: z.string().default("15m"),
    refreshSecret: z.string().min(32),
    refreshExpiry: z.string().default("7d"),
  }),

  encryption: z.object({
    key: z.string().length(64), // 32 bytes hex = 64 chars
  }),

  cors: z.object({
    origin: z.string().or(z.array(z.string())).default("*"),
  }),

  audit: z.object({
    enabled: z.boolean().default(true),
    retentionDays: z.number().default(2555), // 7 years per HIPAA
  }),

  external: z.object({
    labApiUrl: z.string().url().optional(),
    insuranceApiUrl: z.string().url().optional(),
  }),

  fhir: z.object({
    baseUrl: z.string().url().optional(),
  }),
});

// Load environment variables
const rawConfig = {
  env: process.env.NODE_ENV,
  server: {
    host: process.env.SERVER_HOST,
    port: Number(process.env.SERVER_PORT) || 3000,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  redis: {
    url: process.env.REDIS_URL,
    host: process.env.REDIS_HOST,
    port: process.env.REDIS_PORT ? Number(process.env.REDIS_PORT) : undefined,
  },
  mongo: {
    url: process.env.MONGODB_URL,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiry: process.env.JWT_EXPIRY,
    refreshSecret: process.env.REFRESH_SECRET,
    refreshExpiry: process.env.REFRESH_EXPIRY,
  },
  encryption: {
    key: process.env.ENCRYPTION_KEY,
  },
  cors: {
    origin: process.env.CORS_ORIGIN,
  },
  audit: {
    enabled: process.env.AUDIT_LOG_ENABLED === "true",
    retentionDays: Number(process.env.AUDIT_RETENTION_DAYS) || 2555,
  },
  external: {
    labApiUrl: process.env.LAB_API_URL,
    insuranceApiUrl: process.env.INSURANCE_API_URL,
  },
  fhir: {
    baseUrl: process.env.FHIR_BASE_URL,
  },
};

// Validate and parse configuration
export const config = configSchema.parse(rawConfig);

// Export type-safe config
export type Config = z.infer<typeof configSchema>;
