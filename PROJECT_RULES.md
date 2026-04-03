# EHR Webservice - Project Rules & Coding Standards

## Non-Negotiable Standards

These conventions apply to every contributor and PR. Deviations require team consensus.

---

## 1. Language & Type Safety

- **TypeScript strict mode enabled**
- **No `any`** - Use `unknown` for unknown types or define specific interfaces
- **No type assertions** (`as`) unless absolutely necessary and documented
- Enable `strictNullChecks` - null/undefined must be explicitly handled
- **All public APIs** must have complete type definitions

### Example

```typescript
// ❌ WRONG
function process(data: any): any {
  /* ... */
}

// ✅ CORRECT
function process(data: PatientInput): PatientOutput {
  /* ... */
}
```

---

## 2. Module System

- **ESM (ECMAScript Modules)** only
- `"type": "module"` in package.json
- Use `.mjs` or `.ts` extensions explicitly
- Import/export statements only (no `require()`)
- Use `.js` extension in import paths (TypeScript handles this)

### Example

```typescript
// ✅ CORRECT
import { PatientService } from "./patient.service.js";
import type { Patient } from "./patient.entity.js";
export { CreatePatientUseCase } from "./create-patient.use-case.js";
```

---

## 3. Formatting & Linting

### Formatting (Prettier)

- **2 spaces** for indentation (no tabs)
- **Single quotes** for strings (except when string contains single quote)
- **Trailing commas** for multi-line objects/arrays
- **Semicolons** required
- **Max line length**: 100 characters
- **No empty catch blocks**

### Linting (ESLint + @typescript-eslint)

Run before every commit:

```bash
npm run lint:fix
```

Key ESLint rules:

- `@typescript-eslint/no-unused-vars`: error
- `@typescript-eslint/explicit-function-return-type`: warn for public APIs
- `no-console`: error (except `logger` in test/debug)
- `eqeqeq`: always use `===` and `!==`

---

## 4. Git Commit Standards

**Conventional Commits format**:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Formatting changes (no code change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks, dependency updates

### Examples

```bash
git commit -m "feat(patient): add patient search with filters"
git commit -m "fix(billing): resolve race condition in claim submission"
git commit -m "docs: update FOLDER_STRUCTURE_MAP"
```

---

## 5. Branching Strategy

- `main` - Production-ready code (protected)
- `develop` - Integration branch for features
- `feature/<name>` - Feature development
- `fix/<name>` - Bug fixes
- `hotfix/<name>` - Emergency production fixes

### Workflow

1. Create branch from `develop` (or `main` for hotfixes)
2. Make changes, commit often
3. Push branch and create PR to `develop` (or `main`)
4. PR requires at least 1 reviewer
5. Squash merge to keep history clean

---

## 6. Naming Conventions

| Element                  | Convention                 | Example                                |
| ------------------------ | -------------------------- | -------------------------------------- |
| Variables/Functions      | camelCase                  | `createPatient`, `isEligible`          |
| Classes/Interfaces/Types | PascalCase                 | `PatientService`, `IPatientRepository` |
| Files/Folders            | kebab-case                 | `create-patient.use-case.ts`           |
| Constants                | UPPER_SNAKE_CASE           | `MAX_RETRY_COUNT`                      |
| Enum Members             | PascalCase                 | `PatientStatus.Active`                 |
| Private members          | camelCase prefix `_`       | `_logger`                              |
| Test files               | `*.spec.ts` or `*.test.ts` | `patient.entity.spec.ts`               |

---

## 7. Error Handling

### Never Swallow Errors

```typescript
// ❌ WRONG - silently fails
try {
  await patientRepo.save(patient);
} catch (error) {
  // empty catch
}

// ✅ CORRECT - propagate or log
try {
  await patientRepo.save(patient);
} catch (error) {
  logger.error({ error, patientId }, "Failed to save patient");
  throw error; // Rethrow or throw custom error
}
```

### Use Custom Error Classes

```typescript
if (!patient) {
  throw new NotFoundError(`Patient ${id} not found`);
}

if (exists) {
  throw new ConflictError(`Patient with MRN ${mrn} already exists`);
}
```

### Error Handler (app.ts)

Global error handler handles all AppError subclasses with appropriate HTTP status codes.

---

## 8. Secrets & Configuration

### Never commit secrets

- **No API keys, passwords, tokens in code**
- Always use environment variables
- Use `.env` for local development (gitignored)
- Use secret manager in production (AWS Secrets Manager, HashiCorp Vault, etc.)

### .env.example must list all required env vars

```bash
# ✅ CORRECT
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable required');
}
```

---

## 9. Testing Standards

### Test Collocation

- **Unit tests** → `*.spec.ts` adjacent to source files
- **Integration tests** → `tests/e2e/` with real databases (Testcontainers)
- **Fixtures** → `tests/fixtures/` (factory functions, seed data)

### Coverage Requirements

- Domain entities: 100%
- Use cases: 90%
- Routers/HTTP: 85%
- Infrastructure: 80%
- FHIR contracts: 100%

### Testing Rules

- **No mocking database** in e2e tests (use Testcontainers)
- **Mock external APIs** (use Pact or nock)
- Test one behavior per test
- Use descriptive test names
- Arrange-Act-Assert (AAA) pattern

---

## 10. API Versioning

- **URI-based versioning**: `/api/v1/`, `/api/v2/`
- Never change existing API without version bump
- Deprecate old versions with proper headers and documentation
- Maintain backward compatibility within same version

---

## 11. Dependency Injection

### Manual Constructor Injection (No IoC Container)

```typescript
// ✅ CORRECT
export class CreatePatientUseCase {
  constructor(
    private readonly patientRepo: IPatientRepository,
    private readonly eventBus: IEventBus,
    private readonly logger: Logger,
  ) {}
}

// Wire in module file
import { CreatePatientUseCase } from "./application/create-patient.use-case.js";
import { PrismaPatientRepository } from "./infrastructure/prisma-patient.repository.js";

export const createPatientUseCase = new CreatePatientUseCase(
  prismaPatientRepository,
  eventBus,
  logger,
);
```

### Why?

- Explicit dependencies = better testability
- No magic - clear what each class needs
- Simple and maintainable

---

## 12. Logging Standards

### Only Structured JSON Logs

```typescript
// ✅ CORRECT
logger.info(
  { patientId, mrn, action: "created" },
  "Patient created successfully",
);

// ❌ WRONG
console.log(`Patient ${patientId} created`);
```

### Log Levels

- `error` - Errors requiring attention (5xx, exceptions)
- `warn` - Recoverable issues, validation failures, auth failures
- `info` - Normal operations, requests, state changes
- `debug` - Detailed debugging info (dev only)
- `fatal` - Process-ending errors

### Never Log PHI

- No PII in logs (names, SSN, addresses, phone numbers)
- Log resource IDs instead: `patientId: "123"`, not `"John Doe"`
- Use redaction in production (see logger configuration)

---

## 13. Security & HIPAA Compliance

These are **mandatory** for healthcare data:

- ✅ **Audit logging** - All PHI access via `auditMiddleware`
- ✅ **Encryption at rest** - AES-256 for sensitive columns
- ✅ **HIPAA retention** - 7 years audit log retention
- ✅ **JWT short-lived** - 15 minutes + refresh rotation
- ✅ **Rate limiting** - Per user and per IP
- ✅ **RBAC + ABAC** - Role and attribute-based access control
- ✅ **Consent verification** - `consentGuard` before PHI access
- ✅ **Non-root containers** - Run as unprivileged user
- ✅ **No PHI in logs** - Only resource IDs and metadata
- ✅ **TLS 1.3** - Enforced at load balancer/ingress
- ✅ **Graceful shutdown** - Preserve in-flight requests

---

## 14. Database Rules

- **All queries** through Prisma ORM or MongoDB driver
- **Never** raw SQL (use Prisma instead)
- **Indexes** for all foreign keys and query filters
- **Prepared statements** automatically via Prisma
- **Migrations** version-controlled in `prisma/migrations/`

---

## 15. FHIR Compliance

- Use shared `shared/fhir/fhir.types.ts` for FHIR resources
- Implement FHIR R4 (and optionally R5) resource mappers
- Validate FHIR resources against official schemas
- Support both JSON and XML (but prefer JSON)
- Map FHIR resources to domain entities in `infrastructure/`

---

## 16. Performance Guidelines

- **Avoid N+1 queries** - use Prisma `include`/`select`
- **Use Redis caching** for frequently accessed, immutable data
- **Batch database operations** when possible
- **Implement pagination** (default 50 items, max 100)
- **Async processing** for long-running tasks (BullMQ)
- **Connection pooling** handled by Prisma/Redis clients

---

## 17. Code Review Checklist

Before requesting review, ensure:

- [ ] TypeScript compiles (`npm run typecheck`)
- [ ] Linting passes (`npm run lint`)
- [ ] Tests pass (`npm test`)
- [ ] Coverage doesn't decrease
- [ ] No `any` types
- [ ] No console.log (use logger)
- [ ] No secrets in code
- [ ] Error handling complete
- [ ] API versioning correct
- [ ] PHI never logged
- [ ] Audit events fire for PHI access
- [ ] Dependencies correct (domain ← application ← infrastructure)
- [ ] `learning.md` updated if new pattern/decision introduced

---

## 18. Docker & Production

- **Multi-stage builds** reduce final image size
- **Non-root user** (user `ehr`) mandatory
- **Health checks** on `/health` endpoint
- **Structured logs** to stdout (Docker captures)
- **No debug tooling** in production images
- **Immutable tags** - never use `latest` in production
- **Image scanning** for vulnerabilities

---

## 19. Environment Variables Reference

See `.env.example` for complete list. Critical ones:

| Variable       | Description          | Required | Example            |
| -------------- | -------------------- | -------- | ------------------ |
| NODE_ENV       | Environment          | Yes      | `production`       |
| DATABASE_URL   | Postgres connection  | Yes      | `postgresql://...` |
| JWT_SECRET     | JWT signing key      | Yes      | 32+ char random    |
| ENCRYPTION_KEY | AES-256 key (64 hex) | Yes      | `a1b2c3...`        |
| REDIS_URL      | Redis connection     | Dev/Prod | `redis://...`      |
| MONGODB_URL    | MongoDB connection   | Optional | `mongodb://...`    |

---

## 20. Learning Log Maintenance

**Every technical decision gets documented in `learning.md`.** This is non-negotiable.

### When to Add an Entry

- Introducing a new library or dependency
- Choosing one pattern over another
- Solving a non-trivial problem
- Making an infrastructure or security decision
- Answering "why this and not that"

### Entry Format (Senior Engineer Voice)

Write as if explaining to yourself six months from now. No documentation style. No "X is a library that does Y."

Each entry must cover:

1. **What it is** — plain English, one sentence
2. **Why here** — the specific problem it solves in this codebase
3. **How it works under the hood** — the mental model, not the docs
4. **Trade-off accepted** — what we gave up and why
5. **How to reason about it** — when to reach for this again
6. **Code anchor** — exact file path and line number

### Example Entry

```
## Entry N: [Concept Name]

**What it is:** [One sentence]

**Why here:** [Problem it solves here]

**How it works under the hood:** [Internal mental model]

**Trade-off we accepted:** [What we gave up]

**How to reason about it:** [When to use/avoid]

**Code anchor:** `path/to/file.ts:12-34`
```

### Enforcement

- PRs introducing new patterns/technologies must include a `learning.md` entry
- Code review checklist includes: "Is `learning.md` updated?"
- No merge without the entry

---

## 21. Getting Help

- Read [project.md](project.md) for architecture details
- Check [FOLDER_STRUCTURE_MAP.md](FOLDER_STRUCTURE_MAP.md) for folder purposes
- Use `npm run lint:fix` to auto-fix formatting issues
- Ask in team Slack/Discord for design questions
- Reference existing domains as templates

---

## Summary

**Remember the layers:**

```
domains/*/domain/        ← Pure business logic, NO framework deps
domains/*/application/   ← Use cases, orchestrates domain + infra
domains/*/infrastructure/← EFCDomain implementations (Prisma, Redis)
domains/*/presentation/  ← Express routers, Zod schemas
core/                    ← Framework-agnostic utilities
shared/                  ← Reusable libs with optional framework deps
infrastructure/          ← Shared tech (DB, cache, queue, external APIs)
```

**Golden Rule**: Keep domain layer pure. All dependencies point inward.
