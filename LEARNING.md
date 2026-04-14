# LEARNING.md — EHR Webservice

Tech stack, architectural patterns, and reference points for senior developers touching this codebase.

---

## Tech Stack

| Area            | Tool                          | Version  | Notes                                    |
|-----------------|-------------------------------|----------|------------------------------------------|
| Runtime         | Node.js                       | ≥22.0    | ESM only (`"type": "module"`)            |
| Language        | TypeScript                    | 5.3+     | strict mode                              |
| Framework       | Express                       | 5.0      | Major change from v4 — no `body-parser`, native streaming |
| ORM             | Prisma                        | 5.7      | PostgreSQL (not SQLite)                  |
| Database (aux)  | MongoDB                       | 6.3      | Used for audit trail only                |
| Cache/Queue     | Redis + ioredis + BullMQ      | 5.3/5.10 | Background jobs, event processing        |
| Validation      | Zod                           | 3.22     | Request schemas + inferred types          |
| Auth            | jose                          | 5.2      | JWT handling                             |
| Logging         | pino / pino-http              | 8.17     | Structured JSON logs                     |
| Test            | vitest + supertest            | 1.1      | Unit: vitest, Integration: supertest     |
| E2E             | testcontainers                | 10.2     | Real DB in Docker for integration tests  |
| Telemetry       | @opentelemetry/api            | 1.8      | Distributed tracing, metrics             |

---

## Architecture: Clean / Hexagonal Layers

Domain modules follow:

```
domains/{name}/
├── domain/          # Aggregates, value objects, repository interfaces (ports)
├── application/     # Use cases (application services)
├── infrastructure/  # Concrete repo implementations (adapters)
└── presentation/    # HTTP routers, event handlers
```

**Key patterns:**

- **Entity factory methods** (`Patient.create(...)`) — validation + construction in one place. Constructor is `private` to force creation through the factory. Private constructor prevents accidental creation outside the factory.
- **Aggregate Root** — Patient is an Aggregate Root that owns Encounter aggregates. Invariants are enforced inside the entity (e.g., `updateName` validates non-empty names).
- **Repository Pattern** — Interface (`IPatientRepository`) lives in `domain/`, concrete impl (`PrismaPatientRepository`) in `infrastructure/`. Domain layer has zero knowledge of Prisma.
- **Use Cases** — Thin application services: validate input → load/save aggregate → publish domain events. No business logic (that goes in entities).
- **Domain Events** — Published via `IEventBus` after state changes. Fire-and-forget semantics currently; would wire to BullMQ for async processing.

---

## Concepts Worth Knowing

### 1. MRN (Medical Record Number)
The primary identifier for patients. Business rules: 6-12 uppercase alphanumeric characters, unique across the system. Normalized to uppercase on creation.

### 2. Express 5 vs Express 4
This project uses Express 5. Key differences from v4:
- No need for `body-parser` — `express.json()` is built-in and more robust.
- Async error handling improved but `next(error)` is still the pattern.
- `Router` API is similar but middleware ordering matters differently.
- Look up: [Express 5 changelog](https://expressjs.com/en/guide/migrating-5.html)

### 3. Circular Dependency Risk
`patient.entity.ts` imports `Encounter` (for encounter management on the aggregate). `encounter.entity.ts` imports `Patient`. This creates a circular import. Currently works because both reference types not runtime code, but it's fragile — if either file starts calling the other's methods eagerly at module load time, it will cause `undefined` at runtime. Consider decoupling: Patient should hold encounter IDs, not full Encounter objects.

### 4. MockEventBus in Router
The DI in `patient.router.ts` uses an inline `MockEventBus` and direct `new PrismaPatientRepository()`. This is placeholder — a proper DI container or module layer (NestJS-style or a simple IoC container) should replace this. Look up: [TSyringe](https://github.com/microsoft/tsyringe), [Awilix](https://github.com/jeffijoe/awilix), or [Inversify](https://inversify.io).

### 5. Date Utility Separation
Business logic like `calculateAge` and `isMinor` lives in `core/utils/date.utils.ts`, not on the entity itself. The entity delegates to these pure functions. This keeps entities testable and date utilities reuseable.

### 6. Zod Refinements for Composite Validation
The `updatePatientSchema` uses `.refine()` at the schema level to enforce "at least one of firstName or lastName" — this is useful when you need cross-field validation that individual field validators can't express.

### 7. Error Hierarchy
All operational errors extend `AppError` with `statusCode`, `code`, and `isOperational`. This allows the global error handler to differentiate between expected failures (404, 409) and unexpected errors (500). Custom error classes: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `UnprocessableEntityError`, `InternalServerError`, `ServiceUnavailableError`.

### 8. Role-Based Guard
`requireRole(...)` is a middleware-level guard that checks user permissions. Guards are composable. Current roles: `clinician`, `admin`, `billing`. Look up: RBAC patterns in Express.

### 9. Testcontainers for E2E
`test:e2e` script uses testcontainers to spin up real PostgreSQL in Docker for integration tests. This is the gold standard — no mocking of the database for real integration tests. Run `npm run test:e2e` to execute.

---

## Things to Look Up If Unfamiliar

- **Domain-Driven Design** — Eric Evans. Read: Aggregate Roots, Value Objects, Domain Events.
- **Repository + Unit of Work** — The pattern where repositories coordinate persistence. Prisma's implicit UoW via `$transaction` replaces explicit UoW.
- **Clean Architecture / Onion Architecture** — Robert Martin. Dependency rule: outer layers depend on inner layers, never vice versa.
- **CQRS (Command Query Responsibility Segregation)** — Currently use cases mix reads and writes. For larger apps, separate read models (queries) from write models (commands).
- **FHIR (Fast Healthcare Interoperability Resources)** — HL7 standard for healthcare data exchange. Patient maps to `Patient` resource, Encounter maps to `Encounter` resource. Relevant for interoperability.
- **HIPAA Technical Safeguards** — Audit controls, integrity controls, transmission security. This project tracks audit trails in MongoDB.
- **OpenTelemetry** — Distributed tracing standard. `@opentelemetry/api` is imported but wiring may be incomplete. Look up: how to configure OTel with pino and Express.
