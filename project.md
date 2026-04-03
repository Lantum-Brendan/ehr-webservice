# EHR Backend Architecture — Node.js + Express (Production Standard)

## Overview

Production-grade Electronic Health Record backend. Designed for healthcare platforms handling high patient volume, strict HIPAA compliance, and seamless containerized deployment.

**Runtime:** Node.js 22 LTS
**Framework:** Express 5 (TypeScript)
**Architecture:** Clean Architecture + Domain-Driven Design (DDD)
**Pattern:** Modular monolith with extractable boundaries
**Compliance:** HIPAA, GDPR, ONC-ready
**Interoperability:** FHIR R4/R5 first

---

## Conventions We Follow

These are non-negotiable standards across every contributor and PR.

| Concern              | Convention                                                           |
| -------------------- | -------------------------------------------------------------------- |
| Language             | TypeScript strict mode, no `any`                                     |
| Module system        | ESM (`"type": "module"` in `package.json`)                           |
| Formatting           | Prettier — 2 spaces, single quotes, trailing commas                  |
| Linting              | ESLint + `@typescript-eslint` + `eslint-plugin-security`             |
| Git commits          | Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`)            |
| Branching            | `main` (prod) → `develop` → `feature/*`, `fix/*`                     |
| Naming               | `camelCase` vars/functions, `PascalCase` classes, `kebab-case` files |
| Error handling       | Never swallow errors — always propagate or log with context          |
| Secrets              | Never in code. Always in environment via `.env` + secrets manager    |
| Tests                | Collocated `*.spec.ts` for unit, `tests/e2e/` for integration        |
| API versioning       | URI-based — `/api/v1/`, `/api/v2/`                                   |
| Dependency injection | Manual constructor injection — no IoC container magic                |
| Logging              | Structured JSON only — no `console.log` in production code           |

---

## Tech Stack

| Layer             | Technology                          | Why                                           |
| ----------------- | ----------------------------------- | --------------------------------------------- |
| **Framework**     | Express 5 + TypeScript              | Minimal, proven, full control                 |
| **ORM**           | Prisma                              | Type-safe, excellent migrations, multi-DB     |
| **Primary DB**    | PostgreSQL                          | HIPAA-structured clinical data                |
| **Document DB**   | MongoDB                             | Flexible FHIR resources, unstructured notes   |
| **Cache**         | Redis                               | Session store, rate limiting, response cache  |
| **Queue**         | BullMQ (Redis-backed)               | Async jobs — lab orders, notifications        |
| **Auth**          | JWT (jose) + refresh rotation       | Stateless, short-lived tokens                 |
| **Validation**    | Zod                                 | Runtime schema validation, no decorator magic |
| **Logging**       | Pino                                | Structured JSON, extremely fast               |
| **HTTP Security** | Helmet + cors + express-rate-limit  | Baseline hardening                            |
| **FHIR**          | Custom mappers + fhir.js            | R4/R5 resource conversion                     |
| **Testing**       | Vitest + Supertest + Testcontainers | Fast unit + real DB integration               |
| **Observability** | OpenTelemetry + Prometheus          | Traces, metrics, audit trails                 |
| **Container**     | Docker + Docker Compose             | Dev parity, reproducible builds               |
| **Orchestration** | Kubernetes + Helm                   | Production scaling                            |

---

## Project Structure

```bash
ehr-backend/
├── domains/                          # Business domains — the heart of the system
│   ├── patient/
│   │   ├── domain/                   # Pure business logic (zero framework deps)
│   │   │   ├── patient.entity.ts     # Patient aggregate root
│   │   │   ├── patient.repository.ts # IPatientRepository interface
│   │   │   ├── patient.service.ts    # Domain rules (not use cases)
│   │   │   └── events/              # PatientCreated, PatientUpdated
│   │   ├── application/             # Use cases — orchestrate domain + infra
│   │   │   ├── create-patient.use-case.ts
│   │   │   ├── get-patient.use-case.ts
│   │   │   └── search-patients.use-case.ts
│   │   ├── infrastructure/          # Concrete implementations
│   │   │   ├── prisma-patient.repository.ts
│   │   │   ├── patient-fhir.mapper.ts
│   │   │   └── patient-cache.service.ts
│   │   ├── presentation/            # Express router + request/response shapes
│   │   │   ├── patient.router.ts
│   │   │   └── patient.schema.ts    # Zod validation schemas
│   │   └── patient.module.ts        # Wires everything together for this domain
│   ├── encounter/
│   ├── clinical/
│   ├── billing/
│   └── fhir-gateway/               # Unified FHIR R4/R5 API surface
├── core/                            # Cross-cutting, framework-agnostic
│   ├── config/                      # Zod-validated env config
│   ├── errors/                      # AppError base, typed error classes
│   ├── middleware/                  # auth, audit, rate-limit, request-id
│   ├── guards/                      # consent, role, ownership checks
│   └── utils/                       # date helpers, encryption, pagination
├── infrastructure/                  # Shared technical plumbing
│   ├── database/
│   │   ├── prisma.client.ts
│   │   └── mongo.client.ts
│   ├── cache/
│   │   └── redis.client.ts
│   ├── queue/
│   │   ├── queue.client.ts
│   │   └── processors/             # order.processor.ts, notification.processor.ts
│   └── external/                   # Third-party API clients (labs, payers)
├── shared/                         # Internal reusable libraries
│   ├── logger/                     # Pino-based structured logger
│   ├── event-bus/                  # In-process domain event dispatching
│   ├── fhir/                       # FHIR validation, base types
│   └── types/                      # Shared TypeScript types and enums
├── prisma/
│   ├── schema.prisma
│   └── migrations/
├── tests/
│   ├── e2e/                        # Full integration tests with real DB
│   └── fixtures/                   # Seeding helpers, factory functions
├── docker/
│   ├── Dockerfile
│   ├── Dockerfile.dev
│   └── .dockerignore
├── app.ts                          # Express app setup (no listen here)
├── server.ts                       # process.listen, graceful shutdown
├── docker-compose.yml              # Full local dev stack
├── docker-compose.test.yml         # Isolated test environment
├── .env.example
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── ARCHITECTURE.md
```

---

## Dependency Rule (Strictly Enforced)

```
domain/          ← innermost — no imports from Express, Prisma, or Redis
   ↑
application/     ← imports domain only
   ↑
infrastructure/  ← implements domain interfaces, knows about Prisma/Redis
   ↑
presentation/    ← Express routers, Zod schemas, HTTP concerns only
   ↑
core/, shared/   ← available to all layers (logger, errors, config)
```

The domain layer is the one layer that must be kept pure. Anything that touches a database, a network, or a framework lives outside it.

---

## Key Implementation Patterns

### App Bootstrap (`app.ts`)

```typescript
import express from "express";
import helmet from "helmet";
import { requestIdMiddleware } from "./core/middleware/request-id.middleware.js";
import { auditMiddleware } from "./core/middleware/audit.middleware.js";
import { errorHandler } from "./core/errors/error-handler.js";
import { patientRouter } from "./domains/patient/presentation/patient.router.js";

export function createApp() {
  const app = express();

  // Security hardening
  app.use(helmet());
  app.use(express.json({ limit: "1mb" }));
  app.disable("x-powered-by");

  // Request tracing
  app.use(requestIdMiddleware);

  // HIPAA audit trail on every request
  app.use(auditMiddleware);

  // Domain routers
  app.use("/api/v1/patients", patientRouter);
  app.use("/api/v1/encounters", encounterRouter);
  app.use("/api/v1/fhir", fhirGatewayRouter);

  // Global error handler (must be last)
  app.use(errorHandler);

  return app;
}
```

### Graceful Shutdown (`server.ts`)

```typescript
import { createApp } from "./app.js";
import { prisma } from "./infrastructure/database/prisma.client.js";
import { redis } from "./infrastructure/cache/redis.client.js";
import { logger } from "./shared/logger/index.js";

const app = createApp();
const PORT = process.env.PORT ?? 3000;

const server = app.listen(PORT, () => {
  logger.info({ port: PORT }, "Server started");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutdown initiated");
  server.close(async () => {
    await prisma.$disconnect();
    await redis.quit();
    logger.info("Shutdown complete");
    process.exit(0);
  });
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
```

### Domain Entity (Pure — Zero Framework Deps)

```typescript
// domains/patient/domain/patient.entity.ts
export class Patient {
  private constructor(
    public readonly id: string,
    public readonly mrn: string,
    public firstName: string,
    public lastName: string,
    public readonly dateOfBirth: Date,
    public readonly createdAt: Date,
  ) {}

  static create(props: CreatePatientProps): Patient {
    if (!props.mrn) throw new Error("MRN is required");
    return new Patient(
      crypto.randomUUID(),
      props.mrn,
      props.firstName,
      props.lastName,
      props.dateOfBirth,
      new Date(),
    );
  }

  get age(): number {
    return Math.floor(
      (Date.now() - this.dateOfBirth.getTime()) / 31_557_600_000,
    );
  }

  isMinor(): boolean {
    return this.age < 18;
  }
}
```

### Repository Interface (Domain Layer)

```typescript
// domains/patient/domain/patient.repository.ts
export interface IPatientRepository {
  findById(id: string): Promise<Patient | null>;
  findByMrn(mrn: string): Promise<Patient | null>;
  save(patient: Patient): Promise<void>;
  delete(id: string): Promise<void>;
  search(criteria: PatientSearchCriteria): Promise<PaginatedResult<Patient>>;
}
```

### Use Case (Application Layer)

```typescript
// domains/patient/application/create-patient.use-case.ts
export class CreatePatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}

  async execute(input: CreatePatientInput): Promise<Patient> {
    const existing = await this.patientRepo.findByMrn(input.mrn);
    if (existing)
      throw new ConflictError(`Patient with MRN ${input.mrn} already exists`);

    const patient = Patient.create(input);
    await this.patientRepo.save(patient);
    await this.eventBus.publish(new PatientCreatedEvent(patient.id));

    this.logger.info({ patientId: patient.id }, "Patient created");
    return patient;
  }
}
```

### Zod Validation + Express Router (Presentation Layer)

```typescript
// domains/patient/presentation/patient.router.ts
import { Router } from "express";
import { z } from "zod";
import { validate } from "../../../core/middleware/validate.middleware.js";
import { requireRole } from "../../../core/guards/role.guard.js";

const createPatientSchema = z.object({
  mrn: z.string().min(1),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  dateOfBirth: z.string().date(),
  gender: z.enum(["male", "female", "other", "unknown"]),
});

export const patientRouter = Router();

patientRouter.post(
  "/",
  requireRole("clinician", "admin"),
  validate({ body: createPatientSchema }),
  async (req, res, next) => {
    try {
      const patient = await createPatientUseCase.execute(req.body);
      res.status(201).json({ data: patient });
    } catch (err) {
      next(err);
    }
  },
);

patientRouter.get(
  "/:id",
  requireRole("clinician", "admin", "patient"),
  async (req, res, next) => {
    try {
      const patient = await getPatientUseCase.execute(req.params.id);
      if (!patient) return res.status(404).json({ error: "Patient not found" });
      res.json({ data: patient });
    } catch (err) {
      next(err);
    }
  },
);
```

### Structured Error Handling

```typescript
// core/errors/app.error.ts
export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number,
    public readonly code: string,
    public readonly isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFoundError extends AppError {
  constructor(msg: string) {
    super(msg, 404, "NOT_FOUND");
  }
}

export class ConflictError extends AppError {
  constructor(msg: string) {
    super(msg, 409, "CONFLICT");
  }
}

export class ForbiddenError extends AppError {
  constructor(msg: string) {
    super(msg, 403, "FORBIDDEN");
  }
}
```

```typescript
// core/errors/error-handler.ts
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError && err.isOperational) {
    return res
      .status(err.statusCode)
      .json({ error: err.code, message: err.message });
  }

  // Unknown/programmer errors — log fully, return generic 500
  logger.error({ err }, "Unhandled error");
  res
    .status(500)
    .json({ error: "INTERNAL_ERROR", message: "Something went wrong" });
};
```

---

## Containerisation

### `Dockerfile` (Multi-Stage Production Build)

```dockerfile
# ── Stage 1: Build ────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build        # tsc → dist/
RUN npm prune --production

# ── Stage 2: Runtime ──────────────────────────────────
FROM node:22-alpine AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Non-root user — mandatory for HIPAA environments
RUN addgroup -S ehr && adduser -S ehr -G ehr

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package.json ./

USER ehr
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
```

### `Dockerfile.dev` (Hot-Reload Dev)

```dockerfile
FROM node:22-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]   # tsx watch server.ts
```

### `docker-compose.yml` (Full Local Stack)

```yaml
version: "3.9"

services:
  api:
    build:
      context: .
      dockerfile: docker/Dockerfile.dev
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://ehr:ehr@postgres:5432/ehr_dev
      - MONGODB_URL=mongodb://mongo:27017/ehr_dev
      - REDIS_URL=redis://redis:6379
    volumes:
      - .:/app
      - /app/node_modules # Prevent host modules bleeding in
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: ehr
      POSTGRES_PASSWORD: ehr
      POSTGRES_DB: ehr_dev
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U ehr"]
      interval: 5s
      timeout: 3s
      retries: 5

  mongo:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

volumes:
  postgres_data:
  mongo_data:
```

---

## Testing Strategy

| Layer           | Tool                     | Target |
| --------------- | ------------------------ | ------ |
| Domain entities | Vitest                   | 100%   |
| Use cases       | Vitest + mocked repos    | 90%    |
| Routers / HTTP  | Supertest                | 85%    |
| Infrastructure  | Testcontainers + real DB | 80%    |
| FHIR contracts  | Pact                     | 100%   |

```bash
npm test              # All unit tests (Vitest)
npm run test:e2e      # Integration with Testcontainers
npm run test:coverage # Coverage report
```

Unit tests live next to the code they test (`patient.entity.spec.ts`). E2E tests live in `tests/e2e/` and spin up a real Postgres container via Testcontainers — no mocking the DB at this level.

---

## Environment Variables

```bash
# .env.example
NODE_ENV=production
PORT=3000

# PostgreSQL
DATABASE_URL="postgresql://user:pass@host:5432/ehr"

# MongoDB
MONGODB_URL="mongodb://host:27017/ehr"

# Redis
REDIS_URL="redis://redis:6379"

# Auth
JWT_SECRET="min-32-char-secret-change-this"
JWT_EXPIRY=15m
REFRESH_SECRET="different-secret-change-this"
REFRESH_EXPIRY=7d

# Encryption (HIPAA — PHI at rest)
ENCRYPTION_KEY="32-byte-hex-key-for-aes-256"

# FHIR
FHIR_BASE_URL="https://fhir.hospital.com"

# Audit
AUDIT_LOG_ENABLED=true
AUDIT_RETENTION_DAYS=2555  # 7 years per HIPAA

# External
LAB_API_URL="https://labs.partner.com/api"
INSURANCE_API_URL="https://payer.com/fhir"
```

---

## HIPAA Compliance Checklist

- [x] All PHI reads/writes pass through `auditMiddleware`
- [x] Patient consent verified by `consentGuard` before data access
- [x] AES-256 encryption at rest (Postgres column-level encryption)
- [x] TLS 1.3 in transit (enforced at load balancer / ingress)
- [x] RBAC + ABAC enforced on every route
- [x] JWT short-lived (15 min) + refresh rotation
- [x] Rate limiting per user and per IP
- [x] Non-root Docker user
- [x] No PHI in logs — only resource IDs and audit metadata
- [x] 7-year audit log retention capability
- [x] Graceful shutdown preserves in-flight requests

---

## Adding a New Domain

1. Create `domains/new-domain/{domain,application,infrastructure,presentation}/`
2. Define your aggregate root entity in `domain/` — no framework imports
3. Write the repository interface in `domain/`
4. Implement the repository in `infrastructure/` using Prisma
5. Write use cases in `application/` — inject the interface, not the implementation
6. Add the Express router in `presentation/` with Zod schemas
7. Wire everything in `new-domain.module.ts` and mount the router in `app.ts`
8. Add tables to `prisma/schema.prisma` and run `npx prisma migrate dev`

---

## Quick Start

```bash
# Clone and install
git clone https://github.com/your-org/ehr-backend
cd ehr-backend
npm install

# Copy and fill environment
cp .env.example .env

# Spin up full local stack (DB, Redis, API with hot reload)
docker compose up

# Run migrations
npx prisma migrate dev --name init

# Run tests
npm test
```
