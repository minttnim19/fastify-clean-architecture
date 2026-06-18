# Agent Instructions

This repository is a Fastify + TypeScript service following Clean Architecture.
Use these instructions for all AI-agent work in this repo.

## Shell Commands

- Prefer prefixing shell commands with `rtk` when it is available.
- If `rtk` is not installed or misparses a command with flags, run the equivalent command directly or through `rtk proxy`.
- Use `rg` or `rg --files` for searching before slower alternatives.

## Architecture Rules

- Preserve the dependency direction:
  - `domain` may import only from `domain` and `shared`.
  - `application` may import from `domain` and `shared`.
  - `infra` may import from `application`, `domain`, and `shared`.
  - `domain` and `application` must not import from `infra`.
- Keep framework-agnostic contracts and core errors in `src/domain`.
- Keep application orchestration in `src/application/use-cases`.
- Keep Fastify, Redis, HTTP clients, logging, docs, plugins, guards, schemas, and route wiring in `src/infra`.
- Keep reusable low-level utilities and shared types in `src/shared`.
- When a use case needs an external service, define the interface in `src/domain/clients` and implement it in `src/infra/http/clients` with a `*.impl.ts` suffix.

## Route Pattern

The current template endpoint and template base path are scaffolding/example code. They are useful as references for route structure, but they are not permanent product requirements and may be removed or renamed when real service endpoints are introduced.

When adding or changing routes, follow this shape with domain-specific names:

- Use case: `src/application/use-cases/<feature>.use-case.ts`
- Route: `src/infra/http/routes/<feature>.routes.ts`
- Schema: `src/infra/http/schemas/<feature>.schemas.ts`
- Registration: `src/infra/http/app.ts`
- Tests: `tests/unit/application/use-cases` and `tests/unit/infra/http/routes`

The base path should come from the real service contract. Do not preserve the template base path just because it exists in the starter code.

If a task removes or renames template-only endpoints/base paths, update the matching route, schema, use case, registration, tests, README references, and example curl commands together.

When changing the service base path, check all path-aware code instead of only route registration. This commonly includes `src/infra/http/app.ts`, request logging skip rules, Swagger server metadata, route/plugin tests, README endpoint tables, and example curl commands.

## Configuration

- Environment variables are parsed and validated in `src/infra/config/env.ts`.
- When adding, renaming, or removing env vars, update `src/infra/config/env.ts`, `.env.example`, related tests, and README configuration tables together.
- Do not read `process.env` directly outside config/bootstrap code unless there is already a local pattern for that case.

## Implementation Rules

- Read the relevant code path before editing.
- Prefer narrow, behavior-focused changes.
- Do not refactor unrelated files.
- Follow existing naming, import aliases, formatting, and test style.
- Keep Zod request and response schemas in `src/infra/http/schemas`.
- Register new routes in `src/infra/http/app.ts`.
- Add or update focused unit tests for changed behavior.
- Preserve structured logging and metrics contracts unless the task explicitly changes them.
- Update `.env.example`, README, or other docs when config, commands, endpoints, or behavior change.
- Do not introduce new dependencies unless the task clearly requires them.

## Planning

- For small, localized changes, proceed directly after reading the relevant files.
- For larger changes, first produce a short plan that lists:
  - files likely to change
  - architecture boundary considerations
  - tests to add or update
  - validation commands to run
- Do not implement a large refactor without an agreed plan.

## Persistent Plans

- For small localized changes, a chat plan and final summary are enough.
- For medium or large tasks, create or update a plan file under `docs/agent-plans/`.
- Name plan files with the date and task or feature slug, for example `docs/agent-plans/2026-06-17-product-endpoint.md`.
- Keep persistent plans concise and update them when scope, decisions, files changed, or validation status changes.
- Do not create persistent plan files for trivial formatting, typo, or one-line fixes unless the user asks.
- A persistent plan should include:
  - goal
  - scope
  - checklist
  - decisions
  - files changed
  - validation
  - status
- If a task already has a plan file, update the existing file instead of creating a duplicate.

## Verification

Run the narrowest checks that prove the change. For implementation work, prefer:

```bash
rtk npm run type-check
rtk npm run lint
rtk npm test
```

For production or build-impacting changes, also run:

```bash
rtk npm run build
```

If `rtk` is not available, run the same commands without the `rtk` prefix.

## Git Safety

- Check the working tree before editing.
- Do not revert or overwrite unrelated user changes.
- Do not use destructive git commands unless the user explicitly asks for them.
- Commit messages should follow Conventional Commits, for example `feat(products): add product endpoint`.
