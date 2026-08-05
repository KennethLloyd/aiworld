# AIWorld Agent Instructions

## Work Tracking

- Use `docs/plans/README.md` as the plan index and dependency order.
- Treat the relevant file under `docs/plans/` as the detailed engineering
  contract for that plan.
- Use the public [AIWorld MVP GitHub Project](https://github.com/users/KennethLloyd/projects/1)
  for execution status.
- Treat each plan issue as the parent tracker. Break substantial plans into
  child issues before implementation.
- Move the plan or task to `In Progress` before starting work and to `Done`
  only after implementation and verification are complete.
- Link pull requests to child issues with `Refs #<number>`. Use `Closes
  #<number>` only when the whole parent plan is complete.

## Implementation Workflow

1. Read the plan, its dependencies, and the current architecture documents.
2. Inspect the current repository and existing worktree before editing.
3. Implement the smallest coherent ticket without bypassing established
   boundaries.
4. Update the plan implementation record in the same task as the code.
5. Run the applicable local checks before opening or updating a pull request.
6. Report incomplete checks, known risks, and follow-up work explicitly.

## Pull Request Strategy

- Use normal pull requests between independent plans or plan boundaries.
- Use stacked pull requests only for tightly coupled tasks within one plan.
- Build a stacked branch from the preceding branch and target each dependent
  pull request at its immediate predecessor.
- Merge stacked pull requests from foundational work upward, then retarget or
  rebase the remaining branches onto `main`.
- Keep each pull request reviewable and linked to its child issue; do not use a
  stack to avoid breaking down an oversized task.

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

For UI work, run the relevant `agent-browser` flow from the plan after the
application is running. Re-snapshot after navigation or dynamic UI changes.

## Security and Git Hygiene

- Never commit credentials, `.env` files, cookies, auth state, provider keys,
  or screenshots containing secrets.
- Inspect `git status`, `git diff`, and recent history before committing.
- Stage only files related to the requested change.
- Do not reset, checkout, revert, or modify unrelated user changes.
- Keep commits focused and use the repository's conventional commit style.
