# EHR Webservice - Learning Log

**Senior engineer's internal monologue. Not documentation — thinking out loud.**

Every entry answers: what it is, why here, how it works under the hood, what we traded away, and how to reason about reaching for it again.

---

## Entry 1: Zod for Configuration Validation

**What it is:** We use Zod to validate environment variables at startup instead of trusting `process.env` blindly.

**Why here:** Healthcare systems can't afford silent misconfiguration. If `ENCRYPTION_KEY` is 63 characters instead of 64, we need to know immediately — not when the first PHI encryption fails at 3 AM. Zod gives us a single source of truth for what our config _must_ look like.

**How it works under the hood:** Zod schemas are just objects that describe constraints. When we call `configSchema.parse(rawConfig)`, Zod walks every field, validates types, applies defaults, and throws a descriptive error if anything's wrong. The key insight: it's not just type-checking — it's _runtime_ validation that catches env vars that exist but contain garbage.

**Trade-off we accepted:** We added a startup dependency. If Zod has a bug, our app won't start. But that's exactly what we want — fail fast at boot, not slow at runtime. We also accepted the schema definition overhead, but it's self-documenting.

**How to reason about it:** Reach for Zod config validation when: (1) misconfiguration causes data loss or security issues, (2) you have more than 10 env vars, (3) you need different defaults per environment. Don't reach for it when you're building a CLI tool with 3 flags.

**Code anchor:** `core/config/index.ts:4-54`

---

## Entry 2: Clean Architecture Layer Separation

**What it is:** We separate code into four layers (domain, application, infrastructure, presentation) with strict dependency rules — inner layers never import outer layers.

**Why here:** EHR systems have a 10+ year lifespan. The database we use today (PostgreSQL) might not be what we use in 5 years. The framework (Express) will definitely change. Clean architecture means we can swap infrastructure without touching business logic. When HIPAA audit requirements change, we modify one layer, not 50 files.

**How it works under the hood:** The trick is _dependency inversion_. Domain defines interfaces (`IPatientRepository`). Infrastructure implements them. Application depends on the interface, not the implementation. This means domain has zero imports from Express, Prisma, or Redis. It's pure TypeScript. When you see `import { Patient } from '../domain/patient.entity'` in a use case, that's the pattern working.

**Trade-off we accepted:** More files, more indirection, steeper learning curve for juniors. A simple CRUD endpoint requires 4 files instead of 1. But we accepted this because the cost of _changing_ business logic in a monolith is exponential over time, while the cost of navigating layers is linear.

**How to reason about it:** Ask: "Will this system be maintained by more than one person for more than two years?" If yes, clean architecture pays for itself. If you're building a prototype or a weekend project, skip it.

**Code anchor:** `domains/patient/domain/` (pure), `domains/patient/application/` (orchestration), `domains/patient/infrastructure/` (Prisma impl), `domains/patient/presentation/` (Express)

---

## Entry 3: AES-256-GCM for PHI Encryption at Rest

**What it is:** We encrypt sensitive patient data (SSN, addresses) using AES-256-GCM before storing it in the database.

**Why here:** HIPAA mandates encryption at rest for PHI. But more importantly, if someone gets a database dump, they shouldn't be able to read patient SSNs. AES-256-GCM is the standard because it provides both confidentiality and authenticity — you can't tamper with encrypted data without detection.

**How it works under the hood:** GCM mode generates a random 16-byte IV for each encryption operation. The IV, plaintext, and a secret key go through the AES cipher, producing ciphertext and a 16-byte auth tag. We store `iv:ciphertext:authTag` as a single string. On decryption, we verify the auth tag first — if it doesn't match, the data was tampered with or corrupted. This is why we don't use CBC mode (no built-in tamper detection).

**Trade-off we accepted:** We can't query encrypted columns. You can't do `WHERE ssn = '123-45-6789'` because the value in the DB is `a1b2c3...`. We accepted this because SSN lookups should go through an indexed, hashed lookup table anyway — not a direct query on the encrypted value.

**How to reason about it:** Use AES-256-GCM when: (1) you need to encrypt individual fields (not whole-disk encryption), (2) you need tamper detection, (3) you're storing data that must be readable by the application but not by database admins. Don't use it for encrypting large blobs (use file-level encryption) or when you need to query encrypted values (use tokenization instead).

**Code anchor:** `core/utils/encryption.utils.ts:9-30`

---

## Entry 4: Manual Dependency Injection (No IoC Container)

**What it is:** We wire dependencies by hand in module files using constructor injection, not with an IoC container like InversifyJS.

**Why here:** In healthcare, you need to _see_ what depends on what. When a clinician's data access is broken, you need to trace the call chain in seconds, not minutes. IoC containers hide dependencies behind decorators and magic — great for DRY, terrible for debugging production incidents at 2 AM.

**How it works under the hood:** Each domain has a `*.module.ts` file that manually creates instances:

```typescript
const patientRepo = new PrismaPatientRepository(prisma);
const createPatient = new CreatePatientUseCase(patientRepo, eventBus, logger);
```

No reflection, no decorators, no container config. You read the constructor, you know the dependencies. When testing, you pass mocks directly.

**Trade-off we accepted:** More boilerplate. Every new use case requires a manual wiring line. We can't do `@Inject('IPatientRepository')` magic. But we accepted this because the debugging time saved far exceeds the wiring time spent.

**How to reason about it:** Use manual DI when: (1) your team is < 10 people, (2) you need to debug production issues quickly, (3) you want tree-shaking to work (decorators break it). Use an IoC container when you have 50+ services and the boilerplate becomes genuinely unmanageable.

**Code anchor:** `domains/patient/patient.module.ts` (when implemented)

---

## Entry 5: Pino for Structured Logging

**What it is:** We use Pino to output JSON logs instead of `console.log` strings.

**Why here:** In production, logs go to ELK, Datadog, or Splunk. These systems parse JSON. If you log `"Patient 123 created"`, you can't search for `patientId: 123`. With Pino's structured output, you can query `"patientId":"123" AND level:"error"` and get exactly what you need. In healthcare, audit trail searches are a legal requirement — you can't grep through 10GB of unstructured text during a compliance audit.

**How it works under the hood:** Pino builds a JSON object by merging the base metadata, the structured data you pass, and the message. It does this synchronously — no async overhead. The key performance insight: Pino is 5-10x faster than Winston because it avoids string interpolation entirely. When you write `logger.info({ patientId }, 'Created')`, Pino doesn't build a string — it serializes an object.

**Trade-off we accepted:** Pino's default output is ugly for local development. We handle this by using `pino-pretty` in dev mode (adds a transport), which is slower but readable. In production, we skip the transport and get raw JSON to stdout.

**How to reason about it:** Use Pino when: (1) you're shipping logs to a centralized system, (2) you need to query logs by structured fields, (3) performance matters (high-throughput APIs). Use `console.log` when you're building a CLI tool or a script that runs once.

**Code anchor:** `shared/logger/index.ts:5-45`

---

## Entry 6: Express Rate Limiting Strategy

**What it is:** We apply rate limiting globally on `/api/` routes — 100 requests per 15 minutes per IP.

**Why here:** Healthcare APIs are targets. If someone scrapes patient data or brute-forces auth endpoints, we need automatic throttling. The 100/15min limit is deliberately conservative — legitimate clinical workflows don't hit that threshold. If they do, we've designed the frontend wrong.

**How it works under the hood:** `express-rate-limit` maintains an in-memory store (or Redis store in production) mapping IP addresses to request counts. Each request increments the counter. When the counter exceeds the limit, the middleware returns 429 before your route handler ever runs. The `standardHeaders: true` option adds `RateLimit-Limit`, `RateLimit-Remaining`, and `RateLimit-Reset` headers so clients can self-throttle.

**Trade-off we accepted:** In-memory rate limiting doesn't work across multiple server instances. We accepted this for now because we'll move to Redis-backed rate limiting when we scale horizontally. We also accepted that NAT'd users (hospitals) might hit limits faster because they share IPs — we'll solve this with per-user rate limiting later.

**How to reason about it:** Apply rate limiting when: (1) your API is internet-facing, (2) you have authentication endpoints, (3) you're dealing with sensitive data. Don't rate-limit internal service-to-service calls (use mutual TLS instead).

**Code anchor:** `app.ts:34-41`

---

## Entry 7: UUID Primary Keys Instead of Auto-Increment

**What it is:** All database records use UUID v4 as primary keys, not auto-incrementing integers.

**Why here:** In healthcare, patient IDs get transmitted between systems. If you use auto-increment, an attacker can guess the next patient ID (`/patients/12345` → try `/patients/12346`). UUIDs are unguessable. Also, when we eventually shard databases or merge data from multiple hospitals, UUIDs don't collide — integers do.

**How it works under the hood:** `crypto.randomUUID()` generates 128 bits of randomness, formatted as `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`. The collision probability is 1 in 2^128 — you'd need to generate 2.7 \* 10^18 UUIDs to have a 50% chance of one collision. We generate them in application code (`Patient.create()` calls `crypto.randomUUID()`) rather than letting the database generate them, because we need the ID before insertion for event publishing.

**Trade-off we accepted:** UUIDs are 36 characters vs 4-8 bytes for integers. They're slower to index (though PostgreSQL handles this well). We accepted this because the security and distribution benefits outweigh the storage cost — and storage is cheap compared to a data breach.

**How to reasoning about it:** Use UUIDs when: (1) IDs are exposed in URLs or APIs, (2) you might shard or merge databases, (3) you need to generate IDs before persistence. Use auto-increment when you're building an internal admin tool with no external exposure.

**Code anchor:** `prisma/schema.prisma:15` (`@default(uuid())`)

---

## Entry 8: Audit Middleware Pattern

**What it is:** We intercept every HTTP request and log who accessed what, when, and from where — before the route handler runs.

**Why here:** HIPAA requires an audit trail for all PHI access. But more practically, when a patient complains "someone accessed my records," we need to prove who did it. The middleware pattern ensures we never forget to log — it's automatic, not opt-in.

**How it works under the hood:** The audit middleware runs early in the Express chain. It captures request metadata (method, path, IP, user-agent, user ID from JWT) and logs it. Then it monkey-patches `res.send` to intercept the response, capturing the status code and duration. This dual-logging (request + response) gives us complete request lifecycle tracking. The monkey-patch is restored after the response completes.

**Trade-off we accepted:** We log every request, including static assets and health checks. This creates noise. We could add path filtering, but we chose completeness over cleanliness — in an audit, "we didn't log that" is worse than "we logged too much."

**How to reason about it:** Implement audit logging when: (1) you handle regulated data (HIPAA, PCI, GDPR), (2) you need to prove who accessed what, (3) you're building multi-tenant systems. Use middleware for automatic coverage; manual logging is always incomplete.

**Code anchor:** `core/middleware/audit.middleware.ts:10-66`

---

## Entry 9: ESM Over CommonJS

**What it is:** We use ES Modules (`import/export`) instead of CommonJS (`require/module.exports`).

**Why here:** TypeScript 5.x and Node 22+ have solid ESM support. ESM gives us tree-shaking (smaller bundles), top-level await, and static analysis (tools can understand imports without running code). For a healthcare system that might need to run in browsers (FHIR client) or edge environments, ESM is the universal module format.

**How it works under the hood:** With `"type": "module"` in package.json, Node treats `.js` files as ESM. TypeScript compiles our `.ts` files to ESM `.js` files. The key gotcha: ESM requires file extensions in imports (`./patient.js` not `./patient`), even though the source is `.ts`. TypeScript handles this rewriting, but you have to write `.js` in your imports.

**Trade-off we accepted:** Some npm packages still only ship CommonJS. We handle this with dynamic `import()` for those packages. We also accepted the learning curve — ESM has stricter rules (no `require`, no `__dirname`).

**How to reason about it:** Use ESM when: (1) you're starting a new project, (2) you target Node 18+, (3) you want future compatibility. Stick with CommonJS only if you're maintaining a legacy codebase with hundreds of `require` calls.

**Code anchor:** `package.json:6` (`"type": "module"`), `tsconfig.json:4-5` (`"module": "NodeNext"`)

---

## Entry 10: Error Class Hierarchy

**What it is:** We have a base `AppError` class with subclasses for each HTTP status code (BadRequestError, NotFoundError, ConflictError, etc.).

**Why here:** In healthcare, error semantics matter. A 404 (patient not found) requires different handling than a 409 (duplicate MRN). Generic `throw new Error('something broke')` loses this context. Our error classes carry the status code, error code string, and an `isOperational` flag that distinguishes expected errors from programmer mistakes.

**How it works under the hood:** Every custom error extends `AppError`, which extends `Error`. The `isOperational` flag is the key insight: operational errors (bad input, not found) get logged as warnings and return the actual error message. Programmer errors (null reference, unhandled case) get logged as errors and return a generic "Something went wrong" to the client — we don't leak implementation details.

**Trade-off we accepted:** More error classes to maintain. We could use a single `AppError` with different status codes, but explicit classes make the code self-documenting. When you see `throw new ConflictError(...)`, you know the intent without reading the status code.

**How to reason about it:** Use error hierarchies when: (1) you need different HTTP status codes, (2) you want to distinguish operational vs programmer errors, (3) you're building APIs where error semantics matter to consumers. Use plain `Error` for scripts and CLI tools.

**Code anchor:** `core/errors/app.error.ts:5-98`, `core/errors/error-handler.ts:9-83`

---

## Entry 11: Prisma Over Raw SQL or TypeORM

**What it is:** We use Prisma as our ORM instead of writing raw SQL or using TypeORM.

**Why here:** Prisma generates TypeScript types from our schema. This means if we add a column to `Patient`, every query that references that column gets a type error until we update it. TypeORM uses decorators (which pollute domain entities) and raw SQL gives us no type safety. Prisma sits in the middle: type-safe, no decorators, good migration tooling.

**How it works under the hood:** Prisma has two parts: the Prisma engine (written in Rust, handles actual database communication) and the Prisma client (generated TypeScript code). When you run `prisma generate`, it reads your `schema.prisma` and creates a client with methods like `prisma.patient.findMany()`. These methods are fully typed — autocomplete works, and TypeScript catches errors at compile time. The Rust engine handles connection pooling, query building, and parameterized queries (preventing SQL injection).

**Trade-off we accepted:** Prisma's query API is less flexible than raw SQL. Complex aggregations, window functions, or database-specific features require `prisma.$queryRaw`. We accepted this because 95% of our queries are simple CRUD, and for the other 5%, we can drop down to raw SQL with full type safety via `Prisma.sql` template literals.

**How to reason about it:** Use Prisma when: (1) you want type safety without sacrificing DX, (2) you need good migration tooling, (3) you're using PostgreSQL or MySQL. Use raw SQL when you need database-specific features (PostGIS, full-text search). Avoid TypeORM if you care about keeping domain entities pure.

**Code anchor:** `infrastructure/database/prisma.client.ts:8-43`, `prisma/schema.prisma:14-66`

---

## Entry 12: Request ID Tracing

**What it is:** Every request gets a unique ID that flows through logs, errors, and responses.

**Why here:** When a clinician reports "the system gave me an error," we need to find that exact request in our logs. Without request IDs, you're searching by timestamp and guessing. With request IDs, you search `requestId: "a1b2c3"` and get the complete request lifecycle — audit logs, database queries, error stack traces.

**How it works under the hood:** The middleware checks for an `X-Request-Id` header (set by load balancers like AWS ALB). If absent, it generates a truncated UUID (8 chars instead of 36 — enough uniqueness for request tracing, shorter for log readability). The ID is attached to `req.id` and set in the response header. Every subsequent log statement includes `requestId: req.id`.

**Trade-off we accepted:** We truncate UUIDs to 8 characters for readability. This reduces uniqueness from 2^128 to 2^32 — still 4 billion unique IDs, plenty for any request volume. We accepted this trade-off because log readability matters when you're debugging at 2 AM.

**How to reason about it:** Implement request ID tracing when: (1) you have distributed systems or multiple services, (2) you need to correlate logs across middleware, use cases, and infrastructure, (3) you support multiple concurrent users. It's trivial to implement and invaluable for debugging.

**Code anchor:** `core/middleware/request-id.middleware.ts:16-31`

---

## Entry 13: Zod for Request Validation (Not Joi or class-validator)

**What it is:** We validate HTTP request bodies, query params, and route params using Zod schemas in a middleware.

**Why here:** Zod gives us runtime validation AND TypeScript types from the same schema. Define a Zod schema, and `z.infer<typeof schema>` gives you the TypeScript type. Joi requires separate type definitions. class-validator uses decorators that couple validation to your domain entities — exactly what we're trying to avoid in clean architecture.

**How it works under the hood:** The `validate` middleware takes an object with optional `body`, `query`, and `params` Zod schemas. It calls `schema.parseAsync(req.body)` — if validation fails, Zod throws a `ZodError` with detailed field-level errors. The global error handler catches `ZodError` and returns a 422 with structured validation details. If validation passes, `req.body` is replaced with the parsed (and potentially transformed) value.

**Trade-off we accepted:** Zod schemas live in the presentation layer, not the domain layer. This means if you want the same validation in a CLI tool or a queue processor, you need to import from `presentation/`. We accepted this because HTTP validation (required fields, string formats) is different from domain validation (business rules like "MRN must be unique").

**How to reasoning about it:** Use Zod when: (1) you want runtime + compile-time type safety from one definition, (2) you're building APIs where request validation is critical, (3) you want detailed validation error messages. Use class-validator when you're already deep in a NestJS/decorator-heavy ecosystem.

**Code anchor:** `core/middleware/validate.middleware.ts:14-38`

---

## Entry 14: Graceful Shutdown Strategy

**What it is:** We handle SIGTERM, SIGINT, and SIGQUIT signals to cleanly close HTTP connections, database pools, and Redis connections before the process exits.

**Why here:** Kubernetes sends SIGTERM 30 seconds before killing a pod. If we don't handle it, in-flight requests get dropped mid-response. Clinicians see "connection reset" errors. With graceful shutdown, we stop accepting new requests, finish existing ones, close database connections, and exit cleanly.

**How it works under the hood:** `server.close()` stops accepting new connections but keeps existing ones alive. We await this promise, then disconnect Prisma and Redis. The order matters: HTTP server first (stop new work), then databases (finish current work). If any step fails, we log the error and exit with code 1 so Kubernetes knows the shutdown was abnormal.

**Trade-off we accepted:** We added complexity to the startup/shutdown code. We also accepted that if a request takes longer than Kubernetes's grace period (default 30s), it'll still be killed. We could increase the grace period, but that slows deployments.

**How to reason about it:** Implement graceful shutdown when: (1) you run in Kubernetes or any orchestrator that sends SIGTERM, (2) you have long-running requests (> 1s), (3) you use connection pools that need cleanup. Skip it for CLI tools or serverless functions.

**Code anchor:** `server.ts:24-46`

---

## Entry 15: RBAC via Middleware Composition

**What it is:** We check user roles by composing middleware: `requireRole('clinician', 'admin')` runs before the route handler.

**Why here:** Healthcare has strict role boundaries. A nurse shouldn't access billing records. A billing clerk shouldn't read clinical notes. By making role checks middleware, we declaratively express permissions on each route — you read the route definition and immediately know who can access it.

**How it works under the hood:** `requireRole` is a higher-order function — it takes roles and returns middleware. The middleware checks `req.user.roles` (set by an auth middleware that runs earlier). If the user lacks any of the required roles, it throws `ForbiddenError`. The key design decision: we use `.some()` not `.every()` — a user with `['admin', 'clinician']` can access routes requiring `['clinician']`.

**Trade-off we accepted:** Role checks are coarse-grained. "Clinician" can do everything a clinician can do. We'll need ABAC (attribute-based access control) for finer rules like "clinician can only access patients in their department." We deferred this because RBAC covers 80% of our needs, and ABAC adds significant complexity.

**How to reasoning about it:** Use RBAC when: (1) your access control maps to job roles, (2) you have < 10 roles, (3) permissions don't depend on resource attributes. Graduate to ABAC when you need rules like "users can only access resources in their organization."

**Code anchor:** `core/guards/role.guard.ts:25-49`

---

## Entry 16: In-Memory Event Bus (Not Kafka/RabbitMQ Yet)

**What it is:** We have an `InMemoryEventBus` that publishes domain events to subscribers within the same process.

**Why here:** Domain events decouple aggregates. When a patient is created, the billing domain shouldn't directly call the notification service. Instead, `PatientCreatedEvent` is published, and any interested handler can subscribe. Starting with in-memory means we get the decoupling benefits without the operational complexity of Kafka.

**How it works under the hood:** The event bus maintains a `Map<string, Set<EventHandler>>`. When you `publish(event)`, it looks up handlers by event type and executes them asynchronously (fire-and-forget with error catching). The `subscribe` method returns an unsubscribe function — important for cleanup in tests. Handlers run in microtasks (via `Promise.resolve().then(...)`) so they don't block the publisher.

**Trade-off we accepted:** In-memory events are lost if the process crashes. A handler that sends a welcome email might not run if the server dies right after `publish()`. We accepted this because (1) most events are non-critical side effects, (2) we can upgrade to BullMQ/Kafka later without changing domain code (just swap the implementation), and (3) the simplicity wins early.

**How to reasoning about it:** Start with in-memory events when: (1) you're building event-driven architecture for the first time, (2) event loss is acceptable (notifications, analytics), (3) you want to validate the pattern before adding infrastructure. Move to Kafka/BullMQ when: (1) events must survive process crashes, (2) you need cross-service communication, (3) you need event replay.

**Code anchor:** `shared/event-bus/event-bus.interface.ts:49-95`

---

## Entry 17: Helmet for Security Headers

**What it is:** We use the `helmet` middleware to set security headers on every response.

**Why here:** Security headers are easy to forget and hard to get right. Helmet sets `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `X-Frame-Options`, and others. Without these, browsers make assumptions that can be exploited — like allowing MIME sniffing (which can turn a `.txt` upload into executable JavaScript).

**How it works under the hood:** Helmet is a composition of 15+ smaller middleware, each setting one header. It's not doing anything magical — it's just ensuring you don't forget headers that security scanners (and HIPAA auditors) check for. The `helmet()` call with no options uses sensible defaults; you can override individual headers if needed.

**Trade-off we accepted:** Helmet's defaults are conservative. `Content-Security-Policy` might block legitimate inline scripts. We'll hit this when we add a frontend. But we'd rather relax restrictions explicitly than start wide open.

**How to reason about it:** Always use Helmet for internet-facing APIs. Skip it for internal microservices behind a firewall (though even then, defense-in-depth argues for keeping it).

**Code anchor:** `app.ts:22`

---

## Entry 18: Why PostgreSQL + MongoDB (Polyglot Persistence)

**What it is:** We use PostgreSQL for structured clinical data and MongoDB for flexible document storage (FHIR resources, clinical notes).

**Why here:** EHR data has two shapes: (1) highly structured, relational data (patients → encounters → billing records) and (2) semi-structured documents (FHIR resources, free-text notes, JSON clinical documents). PostgreSQL excels at the first — ACID transactions, foreign keys, complex joins. MongoDB excels at the second — schema flexibility, nested documents, horizontal scaling. Trying to force both shapes into one database creates compromises.

**How it works under the hood:** PostgreSQL handles our core domain (patients, encounters, billing) via Prisma. MongoDB handles FHIR resources and clinical notes via the native MongoDB driver. The key insight: we don't try to synchronize them. Each database owns its data. If we need data from both, we fetch from both in the application layer.

**Trade-off we accepted:** Two databases means two connection pools, two backup strategies, two sets of migrations. Operational complexity doubles. We accepted this because the alternative — cramming JSON documents into PostgreSQL's JSONB or normalizing documents into relational tables — creates worse complexity in the code.

**How to reasoning about it:** Use polyglot persistence when: (1) your data has fundamentally different shapes, (2) one database can't serve all access patterns efficiently, (3) you're willing to accept operational complexity. Use a single database when your data is uniformly structured or your team is small.

**Code anchor:** `infrastructure/database/prisma.client.ts` (PostgreSQL), `infrastructure/database/mongo.client.ts` (MongoDB), `docker-compose.yml:29-76`

---

## Entry 19: Consent Guard as Middleware

**What it is:** We verify patient consent before allowing PHI access, implemented as composable middleware.

**Why here:** HIPAA requires patient consent for data access. But consent is contextual — a clinician treating a patient has consent; a researcher querying demographics might not. By making consent verification middleware, we can compose it with role checks: `requireRole('clinician'), requirePatientConsent`. The route handler doesn't need to know about consent logic.

**How it works under the guard:** The consent guard extracts `patientId` from the request (params or body), then checks if the authenticated user has consent to access that patient's data. In production, this would query a consent management system. Our current implementation is simplified — admins and the patient themselves always have consent; clinicians need active consent (placeholder returns true for now).

**Trade-off we accepted:** The consent check adds latency to every PHI access. In production, we'll need to cache consent decisions (Redis, 5-minute TTL) to avoid hitting the consent database on every request. We deferred this because correctness first, performance second.

**How to reasoning about it:** Implement consent verification when: (1) you handle PHI, (2) patients have rights over their data (GDPR, HIPAA), (3) you need to prove compliance. Make it middleware so it's composable and automatic — opt-out is safer than opt-in.

**Code anchor:** `core/guards/consent.guard.ts:8-31`

---

## Entry 20: Vitest Over Jest

**What it is:** We use Vitest as our test runner instead of Jest.

**Why here:** Vitest is built on Vite, which means it uses the same transformation pipeline as our build tool. Jest requires separate Babel/TypeScript configuration that can drift from our production build. Vitest also supports ESM natively — Jest's ESM support is experimental and buggy. Since we committed to ESM, Vitest is the natural fit.

**How it works under the hood:** Vitest uses Vite's dev server under the hood. When you run `vitest`, it starts a Vite server that transforms TypeScript on-the-fly (via esbuild, not tsc). This makes test startup nearly instant compared to Jest, which compiles everything first. The API is Jest-compatible (`describe`, `it`, `expect`), so migration is trivial.

**Trade-off we accepted:** Vitest's ecosystem is smaller than Jest's. Some Jest plugins don't work with Vitest. We accepted this because we don't use many plugins, and the speed improvement (2-5x faster test runs) is worth it for our CI pipeline.

**How to reasoning about it:** Use Vitest when: (1) you're already using Vite or ESM, (2) test speed matters (large test suites), (3) you want a modern, well-maintained test runner. Use Jest when you need specific Jest plugins or your team has deep Jest expertise.

**Code anchor:** `vitest.config.ts:1-42`

---

## Entry 21: Docker Multi-Stage Builds

**What it is:** Our Dockerfile uses multiple stages — a builder stage with dev dependencies and a runtime stage with only production artifacts.

**Why here:** Healthcare compliance requires minimal attack surface. If your production image contains `npm`, `typescript`, and dev dependencies, an attacker who gains container access can install malicious packages. Multi-stage builds ensure the final image contains only compiled JavaScript and production dependencies.

**How it works under the hood:** Stage 1 (`builder`) installs all dependencies, compiles TypeScript, and generates Prisma client. Stage 2 (`runtime`) copies only the `dist/` folder and `node_modules/` (with dev dependencies pruned via `npm ci --omit=dev`). The final image is ~100MB instead of ~500MB. We also run as a non-root user (`ehr`) — required for HIPAA.

**Trade-off we accepted:** Build times are longer because we install dependencies twice (once in builder, once in runtime). We could optimize with cache mounts, but we prioritized image security over build speed.

**How to reasoning about it:** Use multi-stage builds when: (1) your build tools are large (TypeScript, Webpack, Prisma generators), (2) you need minimal production images, (3) compliance requires non-root users. Skip it for interpreted languages (Python, Ruby) where you need the runtime anyway.

**Code anchor:** `docker/Dockerfile` (when implemented), `docker-compose.yml:6-8`

---

## Entry 22: CORS Configuration

**What it is:** We explicitly configure CORS to allow only specific origins, with credentials support.

**Why here:** Without CORS, a malicious site could make requests to our API using a logged-in user's cookies. Healthcare data is high-value — this is a realistic attack vector. By restricting origins, we ensure only our frontend domains can make credentialed requests.

**How it works under the hood:** The `cors` middleware checks the `Origin` header against our allowlist (`config.cors.origin`). If it matches, the response includes `Access-Control-Allow-Origin: <that-origin>` and `Access-Control-Allow-Credentials: true`. If it doesn't match, the browser blocks the response. The `credentials: true` option is critical — it tells the browser to send cookies with cross-origin requests (needed for auth).

**Trade-off we accepted:** We can't use `origin: '*'` with `credentials: true` (browsers block this). So we must enumerate allowed origins. When we add new frontend apps, we need to update the CORS config. We accepted this because security > convenience.

**How to reasoning about it:** Configure CORS explicitly when: (1) your API serves browser-based clients, (2) you use cookies for auth, (3) you want to prevent CSRF-like attacks. Skip CORS config for internal APIs that only serve server-to-server calls.

**Code anchor:** `app.ts:23-28`

---

## Entry 23: FHIR Resource Type Definitions

**What it is:** We define TypeScript interfaces for FHIR R4 resources (Patient, Encounter, Observation, etc.) in `shared/fhir/`.

**Why here:** FHIR is the healthcare interoperability standard. When we exchange data with hospitals, labs, and insurers, it's in FHIR format. Having typed FHIR resources means we catch schema mismatches at compile time, not when a lab's API rejects our payload at runtime.

**How it works under the hood:** We define interfaces that mirror the FHIR R4 spec — `FHIRPatient`, `FHIREncounter`, `FHIRObservation`. These are _structural_ types (TypeScript's shape-based typing), so any object that has the right properties satisfies the interface. We don't use classes because FHIR resources are data, not behavior. When we receive a FHIR bundle from an external system, we validate it against these types.

**Trade-off we accepted:** Our FHIR types are a simplified subset of the full FHIR R4 spec (which has 150+ resource types). We'll add more as needed. We also accepted that FHIR's flexibility (everything is optional) makes our types permissive — we layer stricter validation in our domain entities.

**How to reasoning about it:** Define FHIR types when: (1) you're building a FHIR-compliant API, (2) you exchange data with external healthcare systems, (3) you want compile-time safety for interoperability contracts. Use a FHIR library (like `fhir.js`) if you need full spec coverage.

**Code anchor:** `shared/fhir/fhir.types.ts:1-189`

---

## Entry 24: Health Check Endpoint

**What it is:** A `/health` endpoint that returns server status, uptime, and timestamp.

**Why here:** Kubernetes uses health checks for liveness (is the process alive?) and readiness (can it handle traffic?) probes. Without them, Kubernetes sends traffic to pods that are starting up or stuck. For an EHR system, routing requests to an unhealthy pod means clinicians see errors.

**How it works under the hood:** The endpoint is a simple GET that returns JSON. Right now it only checks process uptime. In production, we'll extend it to check database connectivity (`prisma.$queryRaw`SELECT 1``) and Redis connectivity (`redis.ping()`). If any dependency is down, we return 503 instead of 200.

**Trade-off we accepted:** A health check that checks dependencies can cause cascading failures. If the database is slow, health checks fail, Kubernetes restarts the pod, which creates more database connections, which makes the database slower. We'll mitigate this with circuit breakers on dependency checks.

**How to reasoning about it:** Always implement `/health` when: (1) you run in Kubernetes or any orchestrator, (2) you have dependencies (databases, caches), (3) you need zero-downtime deployments. Make it lightweight (don't query all dependencies on every probe).

**Code anchor:** `app.ts:49-56`

---

## Entry 25: Path Aliases in TypeScript

**What it is:** We configure TypeScript path aliases (`@core/*`, `@shared/*`, `@domains/*`) so imports are clean and relative path hell is avoided.

**Why here:** Without path aliases, deep imports look like `../../../core/errors/app.error`. Move a file, and every relative import breaks. With aliases, it's `@core/errors/app.error` — move the file, update the alias, done. This matters when you have 4+ layers of nesting.

**How it works under the hood:** TypeScript's `paths` option in `tsconfig.json` maps `@core/*` to `./core/*`. But TypeScript only handles type-checking — at runtime, Node doesn't know about path aliases. We need `tsx` (our dev runner) to resolve them, and for production, we'll need a build step that rewrites imports or use `module-alias`.

**Trade-off we accepted:** Path aliases add build complexity. Jest/Vitest needs explicit alias configuration. Production builds need import rewriting. We accepted this because the DX improvement (clean imports, easy refactoring) is worth the config overhead.

**How to reasoning about it:** Use path aliases when: (1) your project has 3+ directory levels, (2) you move files frequently during refactoring, (3) you want imports to express _what_ a module is (`@core/`) not _where_ it is (`../../`). Skip them for small projects (< 20 files).

**Code anchor:** `tsconfig.json:25-30`, `vitest.config.ts:35-40`

---

## Decision Log

| Decision                                  | Why This                                     | Why Not That                               | Trade-off Accepted                       |
| ----------------------------------------- | -------------------------------------------- | ------------------------------------------ | ---------------------------------------- |
| Express 5 over Fastify                    | Middleware ecosystem, team familiarity       | Fastify is faster but smaller ecosystem    | Slightly slower, more middleware options |
| Prisma over TypeORM                       | Type safety without decorators               | TypeORM couples to entities via decorators | Less flexible queries, but pure domain   |
| Zod over Joi                              | Runtime + compile-time types from one schema | Joi requires separate type definitions     | Smaller ecosystem than Joi               |
| Pino over Winston                         | 5-10x faster, structured by default          | Winston has more transports                | Less transport flexibility               |
| Vitest over Jest                          | Native ESM, 2-5x faster                      | Jest has larger ecosystem                  | Fewer plugins available                  |
| Manual DI over InversifyJS                | Explicit, debuggable, no magic               | InversifyJS reduces boilerplate            | More wiring code                         |
| UUIDs over auto-increment                 | Unguessable, globally unique, sharding-ready | Smaller, faster to index                   | Larger storage, slower indexes           |
| In-memory event bus over Kafka            | Simple, validates pattern, no ops overhead   | Kafka survives crashes, cross-service      | Event loss on crash (acceptable early)   |
| PostgreSQL + MongoDB over PostgreSQL only | Right tool for each data shape               | Single DB is simpler operationally         | Two databases to manage                  |
| ESM over CommonJS                         | Standard, tree-shakable, top-level await     | CommonJS has wider package support         | Some packages require dynamic import     |

---

## Entry 26: Underscore Prefix for Unused Parameters

**What it is:** We prefix unused function parameters with underscore (`_req`, `_res`, `_next`) to signal intentional non-use while satisfying Express's required callback signatures.

**Why here:** Express middleware requires `(req, res, next)` signatures even when you only need one or two parameters. Without the underscore convention, TypeScript's `noUnusedParameters` rule would error, and developers would wonder if the parameter should be used.

**How it works under the hood:** TypeScript's `argsIgnorePattern: "^_"` ESLint rule ignores parameters starting with underscore. The underscore is a universal signal: "I know this exists, I intentionally don't use it." When you see `_res` in a route handler, you immediately know: this endpoint doesn't modify the response directly (it returns via the use case).

**Trade-off we accepted:** Slightly uglier signatures. Some developers find `_req` noisy. We accepted this because the alternative — disabling `noUnusedParameters` entirely — would let actual unused parameters slip through.

**How to reason about it:** Use underscore prefix when: (1) the framework requires a signature you don't fully use, (2) you want to document intentional non-use, (3) you have strict linting enabled. Don't use it as an excuse to ignore parameters you should be using.

**Code anchor:** `app.ts:48,57,68`, `core/guards/role.guard.ts:32`

---

## Entry 27: Prisma Event Logging Type Inference

**What it is:** We use `emit: 'event'` instead of `emit: 'stdout'` in Prisma's log configuration to enable typed event handlers.

**Why here:** With `emit: 'stdout'`, Prisma logs directly to stdout and you can't intercept or format the output. With `emit: 'event'`, Prisma emits events that we can handle with `$on('query', callback)` — letting us use our structured Pino logger instead of Prisma's default output.

**How it works under the hood:** Prisma's type system infers valid event types from the `log` configuration array. When you use `emit: 'event'`, TypeScript knows that `$on('query', ...)` and `$on('error', ...)` are valid calls. With `emit: 'stdout'`, the event types become `never` because there's nothing to listen to. The key insight: the type inference flows from the config, not from the method.

**Trade-off we accepted:** Slightly more complex configuration. We had to explicitly type the callback parameters (`e: { query: string; params: string; duration: number }`) because Prisma's generic inference wasn't narrowing correctly. Small price for structured logging.

**How to reason about it:** Use `emit: 'event'` when: (1) you want to control log formatting, (2) you need to route different log levels to different outputs, (3) you want to redact sensitive query parameters. Use `emit: 'stdout'` for simple debugging.

**Code anchor:** `infrastructure/database/prisma.client.ts:9-26`

---

## Entry 28: BullMQ Breaking Changes (v4→v5)

**What it is:** BullMQ v5 removed `QueueScheduler` and renamed `JobOptions` to `JobsOptions`.

**Why here:** We hit this during TypeScript compilation. The old API silently broke — imports appeared to work but types were wrong. This is the danger of major version upgrades without reading migration guides.

**How it works under the hood:** In BullMQ v4, `QueueScheduler` was a separate class that managed delayed jobs and repeatable jobs. In v5, this functionality was consolidated into `JobScheduler` and the queue itself. `JobOptions` (singular) became `JobsOptions` (plural) to align with the naming convention. The `failed` event handler signature also changed: `job` can now be `undefined` if the failure happened before job creation.

**Trade-off we accepted:** We had to rewrite queue initialization code. The old `QueueScheduler` pattern doesn't exist anymore. We accepted this because BullMQ v5 has better type safety and the migration was straightforward once we understood the changes.

**How to reason about it:** When upgrading major versions: (1) read the changelog first, (2) search for renamed/removed exports, (3) check if your type errors point to missing imports. Don't assume backward compatibility — major versions exist to break things.

**Code anchor:** `infrastructure/queue/queue.client.ts:1` (removed `QueueScheduler`, fixed `JobsOptions`)

---

## Entry 29: Pino ESM Import Pattern

**What it is:** We use `import { pino } from 'pino'` (named import) instead of `import pino from 'pino'` (default import) for ESM compatibility.

**Why here:** With ESM and strict TypeScript, the default import `pino` wasn't being recognized as callable. The error was cryptic: "This expression is not callable. Type 'typeof import(".../pino")' has no call signatures."

**How it works under the hood:** Pino exports both a default export and a named export: `export { pino as default, pino }`. In CommonJS, `require('pino')` works because CJS doesn't distinguish between default and named. In ESM, the bundler/runtime must resolve which one you want. Some TypeScript configurations with `"module": "NodeNext"` don't resolve default imports correctly for CJS-authored packages.

**Trade-off we accepted:** Named import is slightly more verbose. We accepted this because it's explicit and works reliably across all ESM configurations.

**How to reason about it:** Use named imports when: (1) the package is CJS-authored but you're using ESM, (2) you get "not callable" errors on default imports, (3) you want explicit imports for better tree-shaking. Check the package's `exports` field in package.json to see what's available.

**Code anchor:** `shared/logger/index.ts:1`

---

## Entry 30: ESLint Configuration for TypeScript Projects

**What it is:** We configure ESLint with `@typescript-eslint/parser` and specific rules to enforce code quality without being overly strict.

**Why here:** TypeScript alone catches type errors, but it doesn't enforce code style or prevent patterns like `console.log` in production code. ESLint fills that gap. Our configuration balances strictness with pragmatism.

**How it works under the hood:** The parser converts TypeScript to an AST that ESLint can analyze. `@typescript-eslint/recommended` provides sensible defaults. We override specific rules: `no-unused-vars` with `argsIgnorePattern: "^_"` allows underscore-prefixed unused parameters, `no-explicit-any` is a warning (not error) because sometimes `any` is necessary for third-party integrations, and `no-console` is an error except in test files.

**Trade-off we accepted:** We have 26 warnings (mostly `any` types in third-party integrations). We could make them errors, but that would require wrapping every external API response in a type — not worth it for code that's already behind an abstraction layer.

**How to reason about it:** Configure ESLint when: (1) you have multiple contributors, (2) you want automated code review for style issues, (3) you need to prevent anti-patterns. Don't over-configure — too many rules creates noise and developers start ignoring warnings.

**Code anchor:** `.eslintrc.json`

---

## Entry 31: Docker Service Naming for Developer Experience

**What it is:** We name the main app service `app` instead of `api` in docker-compose.yml.

**Why here:** The natural command is `docker compose exec app bash`. If the service is named `api`, developers have to remember `docker compose exec api bash` — or worse, `docker compose exec api-container bash` if they forget the exact name. Small friction compounds over hundreds of daily commands.

**How it works under the hood:** Docker Compose uses the service name as the container name prefix. When you run `docker compose exec app bash`, Docker finds the running container for the `app` service and executes bash in it. The service name is purely for developer ergonomics — it doesn't affect networking (services communicate via the service name anyway).

**Trade-off we accepted:** `app` is less descriptive than `api`. Someone reading docker-compose.yml might wonder "app of what?" We accepted this because the DX improvement for the team (who types this command 20+ times daily) outweighs the minor clarity loss for newcomers.

**How to reason about it:** Name services for the command you'll type most. If you'll always `exec` into the main service, call it `app`. If you have multiple app services, use descriptive names (`api`, `web`, `worker`). Don't name services after technologies (`node-app`, `postgres-db`) — that's redundant.

**Code anchor:** `docker-compose.yml:5`

---

## Mental Models for Senior Engineers

### When to Add a Layer of Abstraction

Ask: "What changes independently?" If the database and business logic change at different rates, separate them with an interface. If they always change together, don't abstract.

### When to Choose a Library

Don't choose based on GitHub stars. Choose based on: (1) does it solve my specific problem?, (2) is the API stable (few breaking changes)?, (3) can I replace it later without rewriting everything?, (4) does it have active maintenance?

### When to Optimize

First make it work, then make it right, then make it fast. In healthcare, correctness > performance. A slow but correct system is better than a fast one that miscalculates dosages.

### When to Add Complexity

Every piece of complexity must earn its place. If you can't explain _why_ a pattern exists in one sentence, you don't need it yet. Clean architecture earns its place because: "It lets us change databases without rewriting business logic."

### How to Read a Codebase

Don't read files top-to-bottom. Start with the entry point (`server.ts` → `app.ts`), follow the request flow through middleware, into routers, through use cases, to repositories. Understand the _path_ data takes, not the _contents_ of each file.

---

_This is a living document. Every technical decision we make gets an entry here. Six months from now, when someone asks "why did we do it this way?" — the answer is in this file._
