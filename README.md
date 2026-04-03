# EHR Webservice

Production-grade Electronic Health Record backend built with Node.js, Express, and TypeScript.

**Status**: 🚧 In Development | **Architecture**: Clean + DDD | **Compliance**: HIPAA/GDPR/ONC-ready

---

## Features

✅ **HIPAA Compliant** - Audit logging, encryption at rest, consent verification, 7-year retention
✅ **FHIR R4/R5 Ready** - Built for healthcare interoperability
✅ **Clean Architecture** - Domain-driven design with strict layer separation
✅ **Modular Monolith** - Business domains as self-contained modules
✅ **Production-Ready** - Docker, graceful shutdown, structured logging, observability
✅ **Type-Safe** - Full TypeScript strict mode, Zod validation

---

## Tech Stack

| Layer             | Technology                        | Purpose                      |
| ----------------- | --------------------------------- | ---------------------------- |
| **Runtime**       | Node.js 22 LTS                    | JavaScript runtime           |
| **Framework**     | Express 5                         | HTTP server                  |
| **Language**      | TypeScript                        | Type safety                  |
| **ORM**           | Prisma                            | PostgreSQL client            |
| **Database**      | PostgreSQL 16                     | Structured clinical data     |
| **Document DB**   | MongoDB 7                         | FHIR resources, notes        |
| **Cache**         | Redis 7                           | Sessions, rate limiting      |
| **Queue**         | BullMQ                            | Background jobs              |
| **Validation**    | Zod                               | Runtime schema validation    |
| **Logging**       | Pino                              | Structured JSON logging      |
| **Auth**          | JWT (jose)                        | Short-lived tokens + refresh |
| **Security**      | Helmet, CORS, rate-limit          | HTTP security                |
| **Testing**       | Vitest, Supertest, Testcontainers | Unit + integration           |
| **Container**     | Docker, Docker Compose            | Development + production     |
| **Observability** | OpenTelemetry                     | Traces, metrics, logs        |

---

## Project Structure

```
ehr-webservice/
├── domains/              # Business domains (Patient, Encounter, Clinical, Billing, FHIR)
├── core/                 # Framework-agnostic utilities (config, errors, middleware, guards)
├── infrastructure/      # Technical implementations (DB, cache, queue, external APIs)
├── shared/              # Reusable libraries (logger, event-bus, FHIR types)
├── prisma/              # Database schema and migrations
├── tests/               # Test files (collocated *.spec.ts + e2e/)
├── docker/              # Docker configuration
│   ├── Dockerfile          # Production multi-stage build
│   ├── Dockerfile.dev      # Development with hot reload
│   └── .dockerignore
├── app.ts               # Express app setup
├── server.ts            # Server bootstrap with graceful shutdown
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
└── [docs](file:///home/lantum/Desktop/Projects/ehr-webservice/FOLDER_STRUCTURE_MAP.md)
```

See [FOLDER_STRUCTURE_MAP.md](FOLDER_STRUCTURE_MAP.md) for detailed structure documentation.

---

## Quick Start

### Prerequisites

- Node.js 22+
- Docker & Docker Compose (recommended for local dev)
- Git

### 1. Clone and Install

```bash
git clone <your-repo-url>
cd ehr-webservice
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your configuration (or use defaults for local dev)
```

Minimum required for local dev:

```bash
NODE_ENV=development
DATABASE_URL=postgresql://ehr:ehr@localhost:5432/ehr_dev
JWT_SECRET=your-min-32-char-secret-here
ENCRYPTION_KEY=0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNO
```

### 3. Start Local Stack (Recommended)

```bash
# Start PostgreSQL, Redis, MongoDB, API with hot reload
docker compose up

# In another terminal, run migrations
npx prisma migrate dev --name init

# Seed sample data (optional)
npx prisma db seed
```

The API will be available at `http://localhost:3000`

### 4. Manual Local Setup (Alternative)

If you prefer local databases:

```bash
# Install and start PostgreSQL, Redis, MongoDB locally

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

---

## Testing

```bash
# Run all unit tests
npm test

# Run with coverage
npm run test:coverage

# Run E2E tests with Testcontainers
docker compose -f docker-compose.test.yml up
```

---

## Available Scripts

```bash
# Development
npm run dev              # Start dev server with hot reload (tsx)
npm run build            # Compile TypeScript to dist/
npm run start            # Run production build

# Code quality
npm run lint             # Check code with ESLint
npm run lint:fix         # Auto-fix lint issues
npm run format           # Format with Prettier
npm run typecheck        # Type-check without emitting

# Database
npx prisma migrate dev   # Create and apply migration
npx prisma db push       # Push schema without migration
npx prisma studio        # Open Prisma Studio GUI
npx prisma generate      # Generate Prisma client

# Docker
docker compose up        # Start dev stack
docker compose down      # Stop dev stack
docker compose -f docker-compose.test.yml up  # Run tests

# Observability
# Health check: GET /health
```

---

## API Endpoints

### Root

```
GET /api/v1
GET /health
```

### Version 1 (when domains implemented)

```
GET    /api/v1/patients
POST   /api/v1/patients
GET    /api/v1/patients/:id
PUT    /api/v1/patients/:id
DELETE /api/v1/patients/:id

GET    /api/v1/encounters
POST   /api/v1/encounters

# FHIR R4 API
GET    /api/v1/fhir/Patient
POST   /api/v1/fhir/Patient
GET    /api/v1/fhir/Patient/:id
```

---

## Development Workflow

1. **Create feature branch**

   ```bash
   git checkout -b feature/patient-search
   ```

2. **Add domain module** (if needed)

   ```bash
   mkdir -p domains/new-domain/{domain,application,infrastructure,presentation}
   ```

3. **Implement following Clean Architecture layers**
   - `domain/` - Entities, repository interfaces, domain services (pure TS)
   - `application/` - Use cases (orchestrate domain + infrastructure)
   - `infrastructure/` - Repository implementations (Prisma, Redis)
   - `presentation/` - Express router + Zod schemas

4. **Wire in module**

   ```typescript
   // app.ts
   import { newDomainRouter } from "./domains/new-domain/presentation/new-domain.router.js";
   app.use("/api/v1/new-domain", newDomainRouter);
   ```

5. **Write tests**
   - Unit tests: `domains/new-domain/domain/*.spec.ts`
   - E2E tests: `tests/e2e/new-domain/*.test.ts`

6. **Run checks**

   ```bash
   npm run typecheck
   npm run lint
   npm test
   ```

7. **Commit & push**

   ```bash
   git add .
   git commit -m "feat(domain): add new-domain module with CRUD"
   git push origin feature/patient-search
   ```

8. **Open PR** to `develop` branch

---

## Architecture Principles

### Clean Architecture

Dependencies point inward:

```
presentation → application → domain
                ↑
         infrastructure (implements domain interfaces)
                ↑
        core/, shared/ (available to all)
```

**Domain layer is pure**: No Express, Prisma, Redis, or external libraries.

### DDD + Modular Monolith

Each business domain (`patient`, `encounter`, etc.) is fully isolated with its own:

- Domain entities and value objects
- Repository interfaces
- Use cases (application services)
- Infrastructure implementations
- Express presentation layer

### Dependency Injection

Manual constructor injection only (no IoC container):

```typescript
class CreatePatientUseCase {
  constructor(
    private readonly repo: IPatientRepository,
    private readonly eventBus: IEventBus,
  ) {}
}
```

---

## HIPAA Compliance Checklist

- [x] Audit logging on all PHI access
- [x] AES-256 encryption at rest
- [x] JWT short-lived (15 min) + refresh rotation
- [x] Role-based access control (RBAC)
- [x] Patient consent verification
- [x] Rate limiting per user/IP
- [x] No PHI in logs
- [x] 7-year audit retention
- [x] TLS 1.3 at ingress (load balancer)
- [x] Graceful shutdown
- [x] Non-root Docker user

---

## Environment Variables

See [.env.example](.env.example) for the complete list.

Critical variables:

- `DATABASE_URL` - PostgreSQL connection
- `JWT_SECRET` & `REFRESH_SECRET` - Auth signing keys (32+ chars)
- `ENCRYPTION_KEY` - AES-256 key (64 hex chars)
- `REDIS_URL` - Redis connection
- `MONGODB_URL` - MongoDB connection (optional)

---

## Using the FHIR Gateway

The `fhir-gateway` domain provides a FHIR R4-compliant API surface that maps to your internal domain models.

Example FHIR Patient resource:

```json
{
  "resourceType": "Patient",
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "identifier": [
    {
      "system": "http://hospital.com/mrn",
      "value": "MRN12345"
    }
  ],
  "name": [
    {
      "use": "official",
      "family": "Doe",
      "given": ["John"]
    }
  ],
  "gender": "male",
  "birthDate": "1980-01-15"
}
```

---

## Contributing

**Please read [PROJECT_RULES.md](PROJECT_RULES.md) before contributing.**

Key requirements:

- TypeScript strict mode, no `any`
- Conventional Commits
- Tests required for new features
- No PHI in logs
- Domain layer purity enforced

---

## Documentation

- [FOLDER_STRUCTURE_MAP.md](FOLDER_STRUCTURE_MAP.md) - Complete folder structure guide
- [PROJECT_RULES.md](PROJECT_RULES.md) - Coding standards and conventions
- [project.md](project.md) - Architecture specification

---

## License

MIT (or your organization's license)

---

## Support

- Create an issue for bugs/feature requests
- Check the documentation first
- Follow the existing code patterns

---

**Production Warning**:
This system handles PHI and must be deployed with:

- TLS/HTTPS everywhere
- Proper secrets management (not .env)
- Database backups
- Monitoring and alerting
- Regular security audits
- Incident response plan

---

Built with ❤️ for healthcare
