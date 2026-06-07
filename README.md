# Fastify Clean Architecture

Fastify API template for starting new Node.js services with Clean Architecture, TypeScript, Zod validation, Swagger docs, Redis, metrics, and structured logging.

## Requirements

- Node.js `24.15.0`
- npm
- Docker and Docker Compose, if running with containers

Node version files are included:

```bash
nvm use
```

## Quick Start

```bash
npm install
cp .env.example .env
npm run dev
```

The API starts on `http://localhost:3000` by default.

Core endpoints:

| Endpoint | Description |
| --- | --- |
| `GET /xyz/healthz` | Liveness payload with uptime and environment. |
| `GET /xyz/metrics` | Prometheus metrics. |
| `GET /xyz/docs` | Swagger UI, enabled when `NODE_ENV=development` and `SWAGGER_ENABLED=true`. |

Application routes are registered under the `/xyz` base path.

Check the app:

```bash
curl http://localhost:3000/xyz/healthz
```

## Docker Compose

Run the app with Redis:

```bash
cp .env.example .env
docker compose up -d --build
curl http://localhost:3000/xyz/healthz
```

Redis Commander is available for local inspection:

```bash
docker compose up -d redis-commander
```

Open `http://localhost:8081`.

Default credentials come from `docker-compose.yml`:

- user: `admin`
- password: `admin`

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the Fastify server with hot reload. |
| `npm run build` | Compile TypeScript and rewrite path aliases for `dist`. |
| `npm run start` | Run the compiled server from `dist`. |
| `npm run type-check` | Type-check without emitting files. |
| `npm run lint` | Run ESLint. |
| `npm run lint:fix` | Auto-fix ESLint issues. |
| `npm run format` | Format source and test files with Prettier. |
| `npm run format:check` | Check Prettier formatting. |
| `npm run test` | Run unit tests once. |
| `npm run test:watch` | Run tests in watch mode. |
| `npm run test:coverage` | Run tests with coverage. |

## Configuration

Environment variables are validated in `src/infra/config/env.ts`.

Start from:

```bash
cp .env.example .env
```

Main variables:

| Variable | Purpose |
| --- | --- |
| `PORT`, `HOST` | HTTP bind settings. |
| `NODE_ENV`, `APP_ENV` | Runtime environment labels. |
| `LOG_LEVEL`, `LOG_PATH`, `LOG_TO_FILE` | Logger behavior. |
| `LOG_CHANNEL`, `LOG_PRODUCT`, `SERVICE_TYPE` | Structured log fields. `LOG_CHANNEL` is also the fallback for the `x-channel` request header. |
| `REDIS_URL`, `REDIS_*` | Redis standalone or cluster configuration. |
| `CORS_ORIGIN` | CORS origin setting. |
| `RATE_LIMIT_MAX` | Fastify rate limit per minute. |
| `SWAGGER_ENABLED`, `SWAGGER_USERNAME`, `SWAGGER_PASSWORD` | Swagger UI availability and basic auth. |
| `X_API_KEY` | Shared API key used by routes that attach the API key guard. |
| `HTTP_TIMEOUT_MS` | Default timeout for outbound HTTP clients. |
| `CTP_*` | Commercetools client configuration. |
| `CS_*` | Contentstack client configuration. |

## Project Structure

```text
.
├── src/
│   ├── application/
│   │   └── use-cases/                 # Application orchestration
│   ├── domain/
│   │   ├── clients/                   # Interfaces for external systems
│   │   └── errors/                    # Domain error types
│   ├── infra/
│   │   ├── config/                    # Environment parsing and validation
│   │   ├── database/redis/            # Redis plugin and client
│   │   ├── http/
│   │   │   ├── app.ts                 # Fastify app factory
│   │   │   ├── server.ts              # Process entry point
│   │   │   ├── clients/               # HTTP, Commercetools, Contentstack adapters
│   │   │   ├── context/               # Request context storage
│   │   │   ├── docs/                  # Swagger configuration
│   │   │   ├── guards/                # HTTP guards
│   │   │   ├── plugins/               # Fastify hooks, metrics, error handler
│   │   │   ├── routes/                # Route registration
│   │   │   ├── schemas/               # Zod schemas and Swagger metadata
│   │   │   └── utils/                 # HTTP helpers
│   │   └── logger/                    # Structured logging helpers
│   ├── shared/
│   │   └── types/                     # Shared TypeScript types
│   └── types/
│       └── fastify.d.ts               # Fastify module augmentation
├── tests/
│   └── unit/                          # Unit tests by layer
├── Dockerfile
├── docker-compose.yml
├── package.json
├── tsconfig.json
├── tsconfig.build.json
└── vitest.config.ts
```

## Architecture

The template follows Clean Architecture dependency direction:

```text
HTTP Request
     |
     v
infra/http/routes + infra/http/schemas
     |
     v
application/use-cases
     |
     v
domain interfaces / domain errors
     ^
     |
infra adapters implement domain interfaces
```

Layer responsibilities:

| Layer | Responsibility |
| --- | --- |
| `domain` | Framework-agnostic contracts and core errors. |
| `application` | Use cases that coordinate business flow. |
| `infra` | Fastify, Redis, HTTP clients, logging, docs, and other adapters. |
| `shared` | Cross-cutting types or utilities that do not depend on app layers. |

Import rules:

- `domain/*` should only import from `domain/*` and `shared/*`.
- `application/*` may import from `domain/*` and `shared/*`.
- `infra/*` may import from `application/*`, `domain/*`, and `shared/*`.
- `application/*` and `domain/*` must not import from `infra/*`.

When a use case needs an external service, define the interface in `domain/clients` first and implement it in `infra/http/clients` with the `*.impl.ts` suffix.

## Adding an Endpoint

Use the existing ping endpoint as the smallest example:

- Use case: `src/application/use-cases/ping.use-case.ts`
- Route: `src/infra/http/routes/ping.routes.ts`
- Schema: `src/infra/http/schemas/ping.schemas.ts`
- Registration: `src/infra/http/app.ts`
- Tests: `tests/unit/application/use-cases` and `tests/unit/infra/http/routes`

Typical flow:

1. Add or update a use case in `src/application/use-cases`.
2. Add Zod request/response schemas in `src/infra/http/schemas`.
3. Add a Fastify route in `src/infra/http/routes`.
4. Register the route in `src/infra/http/app.ts`.
5. Add focused unit tests.

## Quality Checks

Run these before opening a pull request:

```bash
npm run format:check
npm run type-check
npm run lint
npm test
```

For a full production build:

```bash
npm run build
```

## Commit Hooks

This repo includes Husky, commitlint, and lint-staged.

Install hooks after dependency installation:

```bash
npm run prepare
```

Commit messages should follow Conventional Commits:

```bash
git commit -m "feat(ping): add ping endpoint"
git commit -m "fix(config): validate redis url"
```

For staged TypeScript files, lint-staged runs ESLint fix and Prettier.
