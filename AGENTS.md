# AGENTS.md

## Delivery workflow

Use GitHub issues as task records and `gh` for issue and pull-request operations. Ship every issue through a pull request.

1. Create a feature branch before editing: `git checkout -b feat/issue-<n>-<slug>`. Follow the existing naming pattern, such as `feat/issue-1-scaffold`. Completion: the work is isolated on its feature branch.
2. Read the root `CONTEXT.md` before changing domain behavior, terminology, or cross-layer contracts. Completion: the implementation uses the documented vocabulary and constraints.
3. Before committing, inspect `git status`, `git diff`, and recent history. Preserve unrelated work, stage only files for the issue, and commit the requested changes on the feature branch. Completion: `git diff --cached` contains only the requested changes immediately before the commit.
4. Run the checks under Verification for each changed surface. Completion: every selected check passes, or each unavailable or failing check is recorded in the pull request.
5. Push the feature branch and open a pull request with `gh pr create`. Start the body with `Closes #<n>`. Completion: the pull request is open and describes the change.
6. Keep the issue open until its pull request merges; GitHub closes it through `Closes #<n>`. Completion: no open pull request has a manually closed issue.

## Triage labels

Use these canonical role labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`.

## Architecture boundaries

- Place transport schemas in `packages/shared` as the single source when data crosses the API boundary.
- Keep generated Prisma types inside concrete repository adapters and seed infrastructure.
- Use dependency injection and repository or provider ports at genuine infrastructure seams.
- Enforce authorization on the NestJS server; use client route guards for UX behavior.
- Keep public observer responses separate from admin prompts, raw provider responses, and telemetry.
- Cover domain decisions with focused unit tests and boundary behavior with integration or end-to-end tests.

## Engineering standard

- Prefer idiomatic Turborepo, Vite, React, TanStack Query, Tailwind, and NestJS capabilities before adding custom infrastructure.
- Preserve existing feature boundaries and dependency direction.
- Keep schemas, persistence, and controllers behind their existing boundaries, with explicit ownership and only genuine seams. This prevents duplicated schemas, direct controller-to-Prisma access, ceremonial indirection, and workaround layers.

## Verification

Run these checks from the repository root for code changes:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

For API changes involving Prisma schema or generated types, also run:

```bash
pnpm --filter @aiworld/api db:generate
```

For API end-to-end work, PostgreSQL and Redis must be available:

```bash
docker compose -f apps/api/docker-compose.yml up -d --wait postgres redis
DATABASE_URL='postgres://postgres:postgres@localhost:5432/aiworld' \
pnpm --filter @aiworld/api exec prisma migrate deploy
pnpm --filter @aiworld/api test:e2e
```

## UI changes

Before opening or updating a UI pull request, complete this browser-first gate:

1. Use the `control-in-app-browser` skill to exercise the changed flow end to end and its affected surrounding areas: validation, loading and error states, edits, retrieval and rendering, downloads, and deletes when applicable. Re-snapshot after navigation or dynamic state changes. Completion: every relevant browser scenario passes and the snapshots show the final states.
2. Verify every materially different affected page and state at an iPhone 15-sized viewport (`393×852`) and a desktop viewport at least `1280px` wide. Completion: both responsive views pass without overflow or behavior regressions.
3. Capture enough screenshots from the in-app browser to cover the change, including complete mobile and desktop views that visibly show the new behavior. Completion: the pull request has the necessary evidence for every affected page or state.
4. Add a `What to expect` section to the pull request description or a pull-request comment in simplified, product-facing technical English. Explain the visible change, key interactions, responsive behavior, and demo-data limitations. Completion: a reviewer can understand and reproduce the changed behavior from the section.

Treat direct browser verification as the acceptance gate; use `agent-browser` for a complementary automated check or fallback when the in-app browser is unavailable.

## Safety

- Keep credentials, `.env` files, cookies, auth state, provider keys, and screenshots containing secrets out of commits.
- Obtain user confirmation immediately before destructive cloud actions. When confirmation is unavailable, use safe checks and document the limitation.
- Preserve unrelated user changes and use recoverable, non-destructive Git operations.
