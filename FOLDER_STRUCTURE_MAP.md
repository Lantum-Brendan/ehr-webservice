# EHR Webservice - Folder Structure Map

This document provides a comprehensive map of the project folder structure, explaining the purpose and contents of each directory.

## Top-Level Structure

```
ehr-webservice/
├── domains/              # Business domains (Clean Architecture layers)
├── core/                 # Cross-cutting concerns (framework-agnostic)
├── infrastructure/      # Technical infrastructure implementations
├── shared/              # Internal reusable libraries
├── prisma/              # Database schema and migrations
├── tests/               # Test files
├── docker/              # Docker-related files
├── .env.example         # Environment variables template
├── .gitignore           # Git ignore patterns
├── app.ts              # Express app configuration
├── server.ts           # Server bootstrap and lifecycle
├── package.json        # Dependencies and scripts
├── tsconfig.json       # TypeScript configuration
├── vitest.config.ts    # Test configuration
├── project.md          # Architecture specification
└── FOLDER_STRUCTURE_MAP.md  # This file
```

---

## Layer 1: Domains (`domains/`)

Business domain modules following Domain-Driven Design (DDD) and Clean Architecture. Each domain is self-contained with its own layered architecture.

### Structure Pattern

```
domains/<domain-name>/
├── domain/          # Pure business logic (entities, value objects, repository interfaces)
├── application/     # Use cases (orchestration of domain + infrastructure)
├── infrastructure/  # EFCDomain implementations (Prisma, Redis, external APIs)
├── presentation/    # Express routers, Zod schemas, DTOs
└── <domain>.module.ts  # Module wiring (dependency injection)
```

### Current Domains

- **patient/** - Patient management, demographics, CRUD operations
- **encounter/** - Clinical encounters, appointments, visits
- **clinical/** - Clinical documentation, diagnoses, treatments
- **billing/** - Billing operations, claims, payments
- **fhir-gateway/** - Unified FHIR R4/R5 API surface for interoperability

### Layer Dependencies (inward only)

```
presentation/  →  application/  →  domain/
    ↑                ↑              ↑
    └─────────────────────────────┘
                    May import shared/ and core/
```

**Rule:** `domain/` must NOT import anything from `application/`, `infrastructure/`, `presentation/`, or any external frameworks.

---

## Layer 2: Core (`core/`)

Cross-cutting concerns that are framework-agnostic and used across all layers.

### `core/config/`

- Configuration management with Zod validation
- Loads and validates environment variables
- `index.ts` - Main configuration object

### `core/errors/`

- Custom error classes extending `AppError`
- `app.error.ts` - Base error and all HTTP error types (400, 401, 403, 404, 409, 422, 500, 503)
- `error-handler.ts` - Express error middleware

### `core/middleware/`

- Express middleware components
- `request-id.middleware.ts` - Generates unique request IDs for tracing
- `audit.middleware.ts` - HIPAA audit logging for all PHI access
- `validate.middleware.ts` - Zod-based request validation

### `core/guards/`

- Authorization and access control guards
- `role.guard.ts` - RBAC enforcement (requires specific roles)
- `consent.guard.ts` - Patient consent verification for PHI access

### `core/utils/`

- Shared utility functions
- `date.utils.ts` - Date parsing, formatting, age calculation
- `encryption.utils.ts` - AES-256-GCM encryption for PHI at rest
- Other utilities as needed

---

## Layer 3: Infrastructure (`infrastructure/`)

Technical implementations of abstractions defined in the domain layer.

### `infrastructure/database/`

Database clients and connections

- `prisma.client.ts` - Prisma ORM singleton for PostgreSQL
- `mongo.client.ts` - MongoDB client for flexible document storage

### `infrastructure/cache/`

Caching layer

- `redis.client.ts` - Redis client singleton with connection management

### `infrastructure/queue/`

Message queue and background job processing

- `queue.client.ts` - BullMQ queue setup with predefined queues
- `processors/` - Job processors
  - `lab-order.processor.ts` - Lab order processing
  - `notification.processor.ts` - Notification sending

### `infrastructure/external/`

Third-party API clients

- `lab-api.client.ts` - Laboratory services integration
- `insurance-api.client.ts` - Insurance/payer integration

---

## Layer 4: Shared (`shared/`)

Internal reusable libraries available to all layers (different from `core/` which are framework-agnostic utilities; `shared/` may have framework deps).

### `shared/logger/`

- Structured logging with Pino
- `index.ts` - Configured logger with environment-specific settings

### `shared/event-bus/`

- Domain event dispatching system
- `event-bus.interface.ts` - IEventBus interface and InMemoryEventBus implementation

### `shared/fhir/`

- FHIR R4/R5 resource types and interfaces
- `fhir.types.ts` - TypeScript interfaces for FHIR resources (Patient, Encounter, Observation, etc.)

### `shared/types/`

- Shared TypeScript type definitions
- `common.types.ts` - Pagination, API responses, user info, audit events, filters

---

## Data Layer

### `prisma/`

- `schema.prisma` - Database schema with all tables/relations
- `migrations/` - Auto-generated migration files

---

## Testing

### `tests/`

- `e2e/` - End-to-end integration tests (Testcontainers + real DB)
- `fixtures/` - Test fixtures, factory functions, seeding helpers
- Unit tests are collocated with source files (`*.spec.ts`)

---

## Docker & DevOps

### `docker/`

- `Dockerfile` - Multi-stage production image (Node 22 Alpine, non-root user)
- `Dockerfile.dev` - Development image with hot reload
- `.dockerignore` - Files to exclude from builds

---

## App Entry Points

### `app.ts`

- Creates and configures Express application
- Registers middleware, routers, security headers
- No server.listen here (separated for testing)

### `server.ts`

- Server bootstrap and lifecycle management
- Graceful shutdown handling (SIGTERM, SIGINT)
- Database and cache connection cleanup

---

## Key Implementation Patterns

### Domain Pattern (inside `domains/<domain>/domain/`)

```typescript
// Entity (pure, no framework deps)
export class Patient {
  /* ... */
}

// Repository interface
export interface IPatientRepository {
  findById(id: string): Promise<Patient | null>;
  save(patient: Patient): Promise<void>;
}
```

### Use Case Pattern (`domains/<domain>/application/`)

```typescript
export class CreatePatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
  ) {}

  async execute(input: CreatePatientInput): Promise<Patient> {
    // Business logic
  }
}
```

### Infrastructure Pattern (`domains/<domain>/infrastructure/`)

```typescript
export class PrismaPatientRepository implements IPatientRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Patient | null> {
    // Prisma implementation
  }
}
```

### Presentation Layer (`domains/<domain>/presentation/`)

```typescript
// Zod validation schemas
const createPatientSchema = z.object({
  /* ... */
});

// Express router
export const patientRouter = Router();
patientRouter.post(
  "/",
  requireRole("clinician", "admin"),
  validate({ body: createPatientSchema }),
  async (req, res, next) => {
    /* ... */
  },
);
```

---

## Configuration Files

### `package.json`

- TypeScript/Node.js project metadata
- Dependencies organized by category
- Scripts for build, test, lint, docker, prisma

### `tsconfig.json`

- TypeScript strict mode
- Path aliases: `@shared`, `@core`, `@domains`, `@infrastructure`
- ESM modules with `"type": "module"`

### `vitest.config.ts`

- Unit test configuration
- Coverage reporting with V8
- Test timeout, environment setup

### `.env.example`

- All required environment variables with descriptions
- HIPAA compliance settings (encryption, audit retention)
- Database, Redis, auth, external API configs

---

## Dependency Rule (Strictly Enforced)

```
domain/          ← innermost — no Express/Prisma/Redis
   ↑
application/     ← imports domain only
   ↑
infrastructure/  ← implements domain interfaces, uses Prisma/Redis
   ↑
presentation/    ← Express routers, Zod schemas only
   ↑
core/, shared/   ← available to all layers
```

**Domain layer must remain pure** - testable without frameworks or external dependencies.
