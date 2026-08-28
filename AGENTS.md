# AIWorld Agent Instructions

## Work tracking

- Use GitHub Issues and the public AIWorld project for status. Use `gh` for
  issue and pull request operations.
- Assign implementation tickets to `KennethLloyd` before starting.
- Move a ticket to `In Progress` before implementation. Mark it `Done` only
  after the pull request is open, checks pass, review is complete, and the
  pull request is merged.
- Use a dedicated `codex/` branch for each ticket. Keep commits focused and
  link pull requests with `Refs #<ticket>` or `Closes #<ticket>` when the
  ticket is complete.
- Treat an opened pull request as the default handoff point. After opening it
  and posting verification details, stop for user review. Never merge a pull
  request, close an issue, mark a ticket `Done`, or change project status
  unless the user explicitly requests that exact post-PR action in the current
  conversation. Passing checks or agent review is not user approval.
- Split substantial work into child tickets before implementation. Represent
  blocking relationships with native GitHub issue dependencies.

## Implementation workflow

1. Follow the complete workflow defined by the `/implement` skill.
2. Use current online documentation when external library or platform facts
   are needed.
3. Before declaring authenticated UI verification blocked, inspect local
   configuration for test credentials without printing secrets.
4. For UI changes, use the in-app browser to exercise affected routes and
   surrounding navigation states in addition to automated tests.
5. Capture desktop and iPhone 15 review screenshots for UI pull requests,
   inspect them for secrets, and include a concise “What to expect” section.
6. Write code comments that are concise, straightforward, and no longer than
   one or two lines unless a longer explanation is essential.
7. Update the ticket and pull request with implementation and verification
   details in the same task.
8. Run the relevant checks, push the branch, open the pull request, post
   implementation and verification details, and stop for user review. Continue
   to merge or close the ticket only after the user explicitly requests it.

## Architecture boundaries

- Keep transport schemas in `packages/shared` when data crosses the API
  boundary; do not duplicate them in the web app.
- Keep generated Prisma types inside concrete repository adapters and seed
  infrastructure.
- Use dependency injection and repository or provider ports at genuine
  infrastructure seams.
- Enforce authorization on the NestJS server. Client route guards are UX
  behavior only.
- Keep public observer responses separate from admin prompts, raw provider
  responses, and telemetry.
- Add focused unit tests for domain decisions and integration or end-to-end
  tests for boundary behavior.

## Engineering standard

- Prefer idiomatic Turborepo, Vite, React, TanStack Query, Tailwind, and NestJS
  capabilities before adding custom infrastructure.
- Keep existing feature boundaries and dependency direction intact.
- Avoid ceremonial indirection, duplicated schemas, direct controller-to-Prisma
  access, and workaround layers that hide unclear ownership.

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

For API end-to-end work, PostgreSQL and Redis must be available:

```bash
docker compose -f apps/api/docker-compose.yml up -d --wait postgres redis
DATABASE_URL='postgres://postgres:postgres@localhost:5432/aiworld' \
pnpm --filter @aiworld/api exec prisma migrate deploy
pnpm --filter @aiworld/api test:e2e
```

For UI work, verify the affected public, authenticated, loading, empty, error,
unauthorized, forbidden, interaction, keyboard, and responsive states directly
in the browser. Automated tests do not replace direct browser verification.

## Security and Git hygiene

- Never commit credentials, `.env` files, cookies, auth state, provider keys,
  or screenshots containing secrets.
- Inspect `git status`, `git diff`, and recent history before committing.
- Stage only files related to the requested ticket.
- Do not reset, checkout, revert, or modify unrelated user changes.

## Project context

`CONTEXT.md` is the source of truth for AIWorld domain vocabulary. Runtime
configuration, package scripts, and the repository layout are the source of
truth for commands and supported local services.
