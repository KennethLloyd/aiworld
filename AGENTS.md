# AIWorld Agent Instructions

## Work Tracking

- Use `docs/plans/README.md` as the plan index and dependency order.
- Treat the relevant file under `docs/plans/` as the detailed engineering
  contract for that plan.
- Use the public [AIWorld MVP GitHub Project](https://github.com/users/KennethLloyd/projects/1)
  for execution status; issues and tickets live in GitHub Issues via the `gh`
  CLI (see `docs/agents/issue-tracker.md`).
- Treat each plan issue as the parent tracker. Split substantial plans into
  child tickets with `/to-tickets` before implementation — tracer-bullet
  vertical slices, each declaring its blocking edges (native GitHub blocking
  links). Work the frontier: a ticket is grabbable when every blocker is
  closed.
- Assign every plan and ticket to `KennethLloyd` before implementation.
- Move the plan or task to `In Progress` before starting work and to `Done`
  only after its pull request is open, required checks pass, implementation and
  verification are complete, you have reviewed and merged the pull request, and
  the review handoff is complete.
- Link pull requests to child tickets with `Refs #<number>`. Use `Closes
#<number>` only when the whole parent plan is complete.

## Implementation Workflow

1. Follow the complete workflow as defined inside the `/implement` skill
2. Always use web search for latest online docs instead of digging through `node_modules`.
3. Comments should be concise and straightforward, simple (max 1-2 lines only)
4. Update the ticket and the plan implementation record in the same task as
   the code.
5. Create a dedicated branch for the ticket; never complete implementation on
   `main`.
6. Commit only the focused ticket changes, push the branch, and open a review
   pull request.
7. Confirm required CI checks pass and wait for the user to review and merge
   the pull request; do not mark the ticket or plan `Done`/`Complete` before
   then.

## Pull Request Strategy

- Use normal pull requests between independent plans or plan boundaries.
- Use stacked pull requests only for tightly coupled tasks within one plan.
- Build a stacked branch from the preceding branch and target each dependent
  pull request at its immediate predecessor.
- Merge stacked pull requests from foundational work upward, then retarget or
  rebase the remaining branches onto `main`.
- Keep each pull request reviewable and linked to its child issue; do not use a
  stack to avoid breaking down an oversized task.
- The completion gate is ordered: `In Progress` -> dedicated branch -> focused
  commit -> pushed branch -> open PR -> passing checks -> user review -> user
  merge -> plan record marked `Complete` and project item marked `Done`.

## Required Boundaries

- Keep transport schemas in `packages/shared` when data crosses the API
  boundary; do not duplicate them in the web app.
- Keep generated Prisma types inside concrete repository adapters and seed
  infrastructure.
- Use dependency injection and repository or provider ports at genuine
  infrastructure seams.
- Enforce authorization on the NestJS server. Client route guards are only UX
  behavior.
- Keep public observer responses separate from admin prompts, raw provider
  responses, and telemetry.
- Add focused unit tests for domain decisions and integration or e2e tests for
  boundary behavior.

## Architecture and Idiomaticity

- Treat idiomatic, framework-native architecture as a hard project constraint.
- Prefer the capabilities already provided by Turborepo, Vite, React,
  TanStack Query, Tailwind, and the existing feature boundaries before adding
  custom scripts, monkey patches, test harnesses, or other workaround layers.
- Do not add noisy or non-idiomatic scaffolding to hide a race condition or
  paper over an unclear ownership boundary. If a workaround is unavoidable,
  document the architectural reason and keep it isolated and minimal.

## Verification

From the repository root, run the checks relevant to the change:

```bash
pnpm install --frozen-lockfile
pnpm --filter @aiworld/api db:generate
pnpm format:check
pnpm lint
pnpm test
pnpm build
```

For API e2e work, PostgreSQL must be available:

```bash
docker compose -f apps/api/docker-compose.yml up -d --wait postgres
DATABASE_URL='postgres://postgres:postgres@localhost:5432/aiworld' \
  pnpm --filter @aiworld/api exec prisma migrate deploy
pnpm --filter @aiworld/api test:e2e
```

For UI work, prefer the `control-in-app-browser` skill when it is available:
use it to inspect the rendered page, exercise the affected interactions, and
spot responsive or visual UX regressions directly. Run the relevant
`agent-browser` flow from the plan as a complementary automated check or as a
fallback when the in-app browser is unavailable. Re-snapshot after navigation
or dynamic UI changes; automated tests do not replace direct browser
verification for UI behavior.

## Security and Git Hygiene

- Never commit credentials, `.env` files, cookies, auth state, provider keys,
  or screenshots containing secrets.
- Inspect `git status`, `git diff`, and recent history before committing.
- Stage only files related to the requested change.
- Do not reset, checkout, revert, or modify unrelated user changes.
- Keep commits focused and use the repository's conventional commit style.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues via the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Five canonical labels: needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one `CONTEXT.md` at the repo root plus `docs/adr/`. See `docs/agents/domain.md`.
