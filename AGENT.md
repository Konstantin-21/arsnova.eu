# AGENT.md

Quick entry point for AI coding agents working in arsnova.eu. Keep this file short and link to canonical docs instead of duplicating them.

**Last reviewed:** 2026-05-31, aligned with the root README, CONTRIBUTING, production docs, CI workflow, and current admin/backend contracts.

## Start Here

- Read [README.md](README.md) for product scope, local setup, production posture, and fork/operator context.
- Read [CONTRIBUTING.md](CONTRIBUTING.md) for contribution workflow, PR expectations, and human review responsibilities.
- Read [Backlog.md](Backlog.md) before story work; it is the source of scope, acceptance criteria, and DoD.
- Use [docs/README.md](docs/README.md) as the documentation map.
- For longer Cursor sessions, use [docs/cursor-context.md](docs/cursor-context.md) as stable project context, but verify stale details against the focused docs and code.

## Always-On Rules

- Work schema-first for API changes: update [libs/shared-types](libs/shared-types) first, then backend, then frontend.
- Use tRPC plus shared Zod schemas as the contract. Do not add ad-hoc REST endpoints or duplicate DTO definitions in app code.
- Never derive permissions from a route, session code, or client state alone. Host-only backend logic must use validated token checks such as `hostProcedure`; standalone feedback and admin access use their own token models.
- Keep participant payloads minimal. Do not expose solution data such as `isCorrect` while a question is active.
- Preserve the effective-vote rule for Peer Instruction scoring, leaderboards, bonus codes, and exports.
- In [apps/frontend](apps/frontend), use Angular standalone components, Signals, and Angular Material 3 tokens. Do not introduce `BehaviorSubject` or RxJS-only state stores for ordinary UI state. Do not add Tailwind there.
- Any user-facing UI text change must keep the locale set in sync: `de`, `en`, `fr`, `es`, `it`.
- Tests are part of done. Add or update the nearest backend and frontend tests for changed behavior.
- Keep docs in sync when setup, environment variables, deployment, security, tests, admin flow, routes, or user-visible behavior change.
- Never commit secrets, `.env` contents, production credentials, or local operational tokens.

## Working Pattern

- Check `git status` before editing and avoid overwriting unrelated work.
- Prefer focused, codebase-local changes over broad rewrites.
- For API work, update shared schemas, backend implementation, frontend usage, and tests in one coherent slice.
- For UI work, verify mobile layout and localized text length deliberately.
- For production or operator-facing changes, verify against [`docker-compose.prod.yml`](docker-compose.prod.yml), [`.env.production.example`](.env.production.example), [`scripts/deploy.sh`](scripts/deploy.sh), [`.github/workflows/ci.yml`](.github/workflows/ci.yml), and the production docs.
- For documentation-only work, still check claims against code or canonical docs before editing.

## Validation Baseline

- General dev: `npm run dev`
- Full typecheck: `npm run typecheck`
- Full tests: `npm test`
- Lint: `npm run lint`
- Production-style validation: `npm run build:prod`
- Workspace-scoped validation: `npm run test -w @arsnova/backend`, `npm run test -w @arsnova/frontend`, `npm run build -w @arsnova/shared-types`
- If you changed frontend templates, styles, or localized copy, finish with `npm run build:localize -w @arsnova/frontend` or the root `npm run build:prod`.
- If you changed Markdown only, at minimum run `npx prettier --check <touched-docs>` and `git diff --check -- <touched-docs>`.
- If you changed production/deploy behavior, also run the relevant checks from [docs/TESTING.md](docs/TESTING.md).

## Canonical Docs

- Documentation map: [docs/README.md](docs/README.md)
- Architecture and boundaries: [docs/architecture/handbook.md](docs/architecture/handbook.md)
- Security and authorization: [docs/SECURITY-OVERVIEW.md](docs/SECURITY-OVERVIEW.md)
- Environment variables: [docs/ENVIRONMENT.md](docs/ENVIRONMENT.md)
- Testing and CI: [docs/TESTING.md](docs/TESTING.md)
- Production deployment: [docs/deployment-debian-root-server.md](docs/deployment-debian-root-server.md)
- Admin flow: [docs/implementation/ADMIN-FLOW.md](docs/implementation/ADMIN-FLOW.md)
- Angular i18n workflow: [docs/I18N-ANGULAR.md](docs/I18N-ANGULAR.md)
- UI rules: [docs/ui/README.md](docs/ui/README.md)
- Architecture decisions: [docs/architecture/decisions](docs/architecture/decisions)

## Scoped Instructions

- Backend work: [.github/instructions/backend.instructions.md](.github/instructions/backend.instructions.md)
- Frontend work: [.github/instructions/frontend.instructions.md](.github/instructions/frontend.instructions.md)
- Shared schema work: [.github/instructions/shared-types.instructions.md](.github/instructions/shared-types.instructions.md)
- Test work: [.github/instructions/testing.instructions.md](.github/instructions/testing.instructions.md)
- Docs work: [.github/instructions/docs.instructions.md](.github/instructions/docs.instructions.md)

## Available Skills

- Story delivery workflow: [.github/skills/story-delivery/SKILL.md](.github/skills/story-delivery/SKILL.md)
