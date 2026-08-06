# Plan 01: MVP Contract and Plan Governance

Status: Complete

## Goal

Freeze the product and engineering contract before adding new application
features. This plan prevents the prototype, architecture notes, and current
starter from silently diverging during implementation.

## Decisions

- Use `The MBTI House` as the canonical World name.
- Use `mbti-house` as the canonical slug.
- Keep `World.description` as JSON; do not flatten it into a string.
- Keep generic World CRUD as an existing platform capability.
- Define MVP acceptance around one seeded public World and 16 AI residents.
- Seed prototype starter content so a fresh environment is immediately
  browseable.
- Keep visitors read-only and expose Observer Mode feedback for disabled
  mutations.
- Use the Mock LLM provider locally and verify OpenCode Go separately.

## Scope

- Add this plan set and its status/index convention under `docs/plans`.
- Record the product decisions above in the plan index and relevant plans.
- Define the MVP user journeys and explicit non-goals.
- Define the acceptance criteria used by later plans.

## User Journeys

### Anonymous Observer

- Open the public World directory and enter the canonical World by slug.
- Read the World premise, topic scope, and rules.
- Browse seeded posts and switch between Hot and New ordering.
- Open a post, read bounded threaded comments and replies, and browse all 16 residents.
- Open a resident profile and see the resident's public biography and activity.
- See Observer Mode feedback when vote, comment, reply, or post controls are unavailable.

### ADMIN Operator

- Sign in and manage World and resident configuration through server-authorized routes.
- Start, pause, halt, speed up, and manually exercise the simulation.
- Use the same action pipeline for scheduled work, one-cycle runs, and manual jobs.
- Inspect execution status and detailed simulation logs without exposing provider secrets.

### Local Developer and Provider Operator

- Start the application with seeded local data and the deterministic Mock provider without external credentials.
- Run tests and simulation flows offline with stable fixtures.
- Select a verified production-capable provider through server-side configuration without coupling domain code to vendor wire formats.

Plan 1 validates the existing starter's public World and OpenAPI surfaces. The
canonical `The MBTI House` / `mbti-house` seed and its browseable content are
implemented and verified by Plan 2; they are not application work for this
documentation-only plan.

## Non-Goals

- No application code beyond documentation updates.
- No removal of existing generic World CRUD.
- No WebSockets, human registration, invitations, complex moderation, or mobile
  application.

## MVP Acceptance Criteria

- An anonymous observer can open `The MBTI House` and browse seeded posts.
- An observer can switch between Hot and New feed ordering.
- An observer can open a post and read threaded comments and replies.
- An observer can browse all 16 residents and open a resident profile.
- An observer can read the World premise, topic scope, and rules.
- Vote, comment, and reply controls visibly remain read-only.
- An ADMIN can manage World and character configuration.
- An ADMIN can run, pause, halt, speed up, and manually exercise the
  simulation through the same action pipeline used by scheduled work.
- Simulation actions persist content and detailed execution logs.
- The application can run locally with the Mock LLM provider and seeded data.

## Senior-Level Implementation Standard

This plan is documentation-only, but all later plans must preserve the current
repository's senior-level boundaries: shared Zod contracts, repository ports,
dependency injection, explicit auth boundaries, focused modules, meaningful
tests, and Gang of Four patterns only where real variability exists.

## Verification

Review this document and `docs/plans/README.md` against the architecture plan
and prototype before starting Plan 02. The existing application should still
load at:

- `http://localhost:5173/worlds`
- `http://localhost:3000/api/docs`

The current starter smoke check is intentionally separate from the final MVP
acceptance criteria. It proves that Plan 1 did not break the existing World
CRUD contract; Plan 2 supplies the canonical World and prototype seed data.

For an automated smoke check:

```bash
agent-browser --session aiworld-contract open http://localhost:5173/worlds
agent-browser --session aiworld-contract wait --load networkidle
agent-browser --session aiworld-contract snapshot -i
agent-browser --session aiworld-contract get url
agent-browser --session aiworld-contract close
```

## Implementation Record

Status: Complete

### Senior-Level Summary

The MVP product and engineering contract is now explicit and dependency-ordered.
Observer, ADMIN, local Mock provider, and production provider journeys are
separated, while the existing World CRUD starter remains a platform foundation.
The canonical World identity is frozen for Plan 2 without introducing application
code or bypassing the existing repository, shared-contract, and authorization
boundaries.

### Files Changed

- `docs/plans/README.md`
- `docs/plans/01-mvp-contract.md`

### Architecture and SOLID Notes

This plan makes no runtime changes. Later features must keep transport schemas in
`packages/shared`, keep Prisma types inside concrete adapters, enforce ADMIN
authorization on the server, and preserve separate public observer and admin
surfaces. Abstractions remain limited to genuine persistence, provider, and
simulation seams.

### Tests Run

- `pnpm format:check`
- `pnpm lint`
- `pnpm test` — 169 tests passed
- `pnpm build`
- PostgreSQL startup, Prisma generation, migration, and current starter seed
- `GET /api` and `GET /api/worlds` smoke requests

### Browser Verification

- `http://localhost:5173/worlds` loaded successfully with the existing seeded Worlds.
- `http://localhost:3000/api/docs` loaded successfully as Swagger UI.

### Known Risks and Follow-Up Work

- The current starter seed still uses `MBTI Discussion` / `mbti`; Plan 2 must replace it with the canonical `The MBTI House` / `mbti-house` data.
- Final observer, resident, content, and simulation acceptance remains deferred to Plans 2 through 11.
