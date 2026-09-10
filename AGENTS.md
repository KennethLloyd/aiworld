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

- Use schemas in `packages/shared` as the single source of truth for data that crosses the API boundary.
- Use `Controller → Service → PrismaService` for ordinary backend persistence. Controllers own transport concerns; services own application behavior and persistence. Generated Prisma types stay within the backend boundary.
- Add repository or provider ports only at a genuine infrastructure seam, such as interchangeable external providers. Use dependency injection without wrapping Prisma in ceremonial abstractions.
- Enforce authorization in the NestJS API. Client route guards improve UX but are not a security boundary.
- Keep public observer responses free of admin prompts, raw provider responses, and telemetry.
- Keep deployment and infrastructure concerns outside this repository unless application behavior depends on them.

## Engineering standard

- Start with the simplest idiomatic capability provided by Turborepo, Vite, React, TanStack Query, Tailwind, NestJS, Prisma, BullMQ, or the hosting platform.
- Preserve feature boundaries and give each responsibility one clear owner. Keep the main flow short enough to follow without ceremonial indirection.
- Keep source comments to two lines or fewer. Comment only on non-obvious domain or infrastructure constraints.

## Simplicity and scope

- Add an abstraction, wrapper, cache, concurrency control, or custom infrastructure only when a current requirement needs it. Record the concrete requirement in the issue or pull request.
- Treat existing complexity as a claim to re-evaluate. Remove obsolete machinery when no current product behavior depends on it.
- Keep focused changes focused. Change adjacent code only when required for correctness or to preserve an ownership boundary.
- Design for current scale and failure modes. Revisit portability or future scale when a concrete need appears.

## Tests

- Protect meaningful product behavior, domain rules, security and privacy boundaries, persistence invariants, integrations, and important failure or recovery paths.
- Use the strongest practical layer for each behavior: focused unit tests for domain decisions and integration or end-to-end tests for boundaries.
- Before adding a test, confirm existing coverage does not already protect the behavior at a stronger layer.
- Add tests for framework wiring, implementation details, configuration, presentation markup, query keys, logging, or fixtures only when they protect a demonstrated regression risk.

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
pnpm --filter @aiworld/shared build
pnpm --filter @aiworld/api db:generate
```

For API end-to-end work, PostgreSQL and Redis must be available:

```bash
docker compose up -d --wait postgres redis
pnpm --filter @aiworld/shared build
DATABASE_URL='postgres://postgres:postgres@localhost:5432/aiworld' \
pnpm --filter @aiworld/api exec prisma migrate deploy
pnpm --filter @aiworld/api test:e2e
```

## UI changes

Before opening or updating a UI pull request, complete this browser-first gate:

1. Exercise the changed flow end to end with in-app browser control. Cover each affected validation, loading, error, edit, retrieval, rendering, download, and delete path that applies. Re-snapshot after navigation and dynamic state changes. Completion: every relevant scenario passes and the final states are visible in snapshots.
2. Verify every materially different affected page and state at an iPhone 15-sized viewport (`393×852`) and a desktop viewport at least `1280px` wide. Completion: both responsive views pass without overflow or behavior regressions.
3. Attach complete mobile and desktop screenshots for every materially different affected page or state to the pull request. Keep screenshots out of the repository and free of secrets. Completion: the pull request visibly demonstrates the changed behavior at both viewports.
4. Add a `What to expect` section to the pull request description or a pull-request comment in simplified, product-facing technical English. Explain the visible change, key interactions, responsive behavior, and demo-data limitations. Completion: a reviewer can understand and reproduce the changed behavior from the section.

Direct browser verification is the acceptance gate. Use `agent-browser` as a complementary automated check or as the fallback when in-app browser control is unavailable, and record that limitation in the pull request.

## Safety

- Keep credentials, `.env` files, cookies, auth state, provider keys, and screenshots containing secrets out of commits.
- Obtain user confirmation immediately before destructive cloud actions. When confirmation is unavailable, use safe checks and document the limitation.
- Preserve unrelated user changes and use recoverable, non-destructive Git operations.
