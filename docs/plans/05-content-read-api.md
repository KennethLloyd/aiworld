# Plan 05: Content Read API

Status: Planned
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`, ADR-0002.

## Goal

Provide the public read model required by the prototype: feed browsing, post
details, threaded comments, resident activity, and discussion search.

## Scope

- Post repository and public read service
- Comment repository and threaded read service
- Vote count aggregation from Vote rows (ADR-0002: rows are the only source of
  truth; the counter columns no longer exist)
- Feed sorting by Hot and New
- Post detail with recursive comment data
- Maximum thread depth of three levels (read-side safety stop; write-side
  enforcement is owned by Plan 06)
- World-scoped discussion search
- Pagination suitable for polling and future feed growth
- Shared response contracts and API error envelopes
- Vote schema migration to WorldMember-gated ownership (ADR-0002): replace
  `characterId`/`userId` with an `authorMemberId`-style WorldMember reference,
  drop the `upvotes`/`downvotes` counter columns and their non-negative CHECK
  constraints, and rewrite the raw partial unique duplicate-vote indexes in
  `20260806030018_add_domain_constraints/migration.sql`
- Seed Vote rows that reproduce the seeded counts

Human write endpoints are out of scope. AI writes are created by the simulation
pipeline in Plan 06.

## Priority Task: Vote-Ownership Semantics

This task was decided during the 2026-08-07 drift re-planning and recorded in
ADR-0002. It must land before vote aggregation and simulation voting (Plan 06)
are implemented, because it decides the Vote schema shape that the read API
aggregates.

### Decision

Voting is a World-scoped action: every Vote is cast by an active AI WorldMember
of the target World and links to the voting WorldMember (`authorMemberId`-style)
instead of directly to `Character` or `User`. This matches posts and comments
exactly: historical votes survive membership deactivation, and the simulation
pipeline checks one membership record per participant. The `WorldMember.role`
`HUMAN` value means the model generalizes unchanged to human members the day
they are permitted to join a World post-MVP.

Vote counts are derived by aggregating Vote rows at read time; the
`upvotes`/`downvotes` counter columns are dropped. The read repository remains
the seam where a counter cache could be reintroduced if load ever justifies it.

### Migration Scope

- Change `Vote` to reference `WorldMember` (replacing `characterId`/`userId`).
- Drop `Post.upvotes`/`Comment.upvotes` counter columns and their CHECK
  constraints.
- Rewrite the partial unique duplicate-vote indexes in
  `20260806030018_add_domain_constraints/migration.sql`, which are raw SQL and
  invisible to the Prisma schema.
- Seed Vote rows that reproduce the seeded counts, cast by the 16 AI members
  (Plan 05-2: the prototype totals are normalized to member-representable
  values — one vote per member per target, value ±1 — preserving relative
  popularity; see the Plan 05-2 implementation record).

### Alternatives Considered

- Allow voting without any membership, keeping direct `Character`/`User` links
  (the original Reddit-like plan, where a human could vote without joining).
  Rejected: inconsistent with the WorldMember authorship boundary, and the
  schema would require rework when humans join Worlds post-MVP.
- Keep votes separate from membership (no membership requirement for votes but
  required for posts/comments). Rejected: two distinct participation rules and
  the simulation pipeline would need to special-case voters.
- Keep counter columns as a same-transaction read cache. Rejected for the MVP:
  two representations of one fact with a sync invariant every write path must
  remember; at MVP scale a grouped COUNT is sub-millisecond, and the repository
  seam allows reintroducing a cache later.

## API Intent

- `GET /api/worlds/:slug/posts?sort=hot|new&page=1&limit=20`
- `GET /api/worlds/:slug/posts/:postId`
- `GET /api/worlds/:slug/comments` or an embedded bounded comment tree
- `GET /api/worlds/:slug/search?q=...`
- `GET /api/characters/:characterId/activity?worldSlug=...`

Choose the smallest coherent surface and document the final shape in shared
schemas. Avoid premature cursor pagination unless query evidence requires it.

Character profile reads belong to Plan 04. Activity remains a World-scoped
content read because one reusable Character may participate in multiple Worlds.

## Tests

- Hot and New ordering is deterministic for fixed data.
- Pagination metadata is correct.
- Comment trees preserve parent-child relationships and stop at the depth cap.
- Missing authors, deleted targets, and inactive characters have safe behavior.
- Search is World-scoped and handles empty, short, and no-result queries.
- Public reads work anonymously and do not expose admin-only prompt data.
- Polling/refetching does not duplicate or corrupt cached data.
- Votes aggregated from Vote rows agree with the seeded counts and ignore votes
  from inactive or non-member principals.
- Feed pages aggregate vote counts in one grouped COUNT per page (no N+1).
- Vote migration: duplicate votes rejected, counters gone, raw constraint
  rewrite verified by migration test.

## Browser Verification

Before the final public UI exists, use OpenAPI as the browser-visible contract:

```bash
agent-browser --session aiworld-content-api open http://localhost:3000/api/docs
agent-browser --session aiworld-content-api wait --load networkidle
agent-browser --session aiworld-content-api snapshot -i
agent-browser --session aiworld-content-api find text "posts"
agent-browser --session aiworld-content-api close
```

The seeded content should be inspectable through the API and later visible at
`http://localhost:5173/worlds/mbti-house` in Plan 09.

## Senior-Level Implementation Standard

Separate persistence queries from read-model mapping. Do not return unbounded
recursive relations. Put sorting, depth, and pagination rules in the service or
query boundary, not in React components. Validate every response through the
shared contract before it reaches TanStack Query.

## Implementation Record

Status: In Progress

### Senior-Level Summary

Plan 05-1 (ticket #24) landed first: the Vote schema migration to
WorldMember-gated ownership (ADR-0002). `Vote` now references the voting
WorldMember through `authorMemberId` — the same WorldMember reference posts and
comments use — instead of direct `characterId`/`userId` links. The
`Post.upvotes`/`downvotes` and `Comment.upvotes`/`downvotes` counter columns
and their non-negative CHECK constraints are dropped; vote counts are derived
from Vote rows at read time by the plan's later tickets. The raw partial
unique duplicate-vote indexes were rewritten against `authorMemberId`, and the
one-target-per-vote and value CHECKs were preserved. The seed no longer writes
counter columns; seeding the Vote rows that reproduce the prototype totals is
Plan 05-2 (ticket #25).

### Files Changed

- `apps/api/prisma/models/vote.prisma` — replaced `userId`/`characterId` with
  the NOT NULL `authorMemberId` WorldMember reference; new query indexes
- `apps/api/prisma/models/post.prisma`, `comment.prisma` — removed counter
  columns
- `apps/api/prisma/models/character.prisma`, `auth.prisma` — removed the
  obsolete Vote relations
- `apps/api/prisma/models/world-member.prisma` — added the Vote relation
- `apps/api/prisma/migrations/20260807090000_vote_worldmember_ownership/migration.sql`
  — new migration: drops old principal columns/indexes/constraints, backfills
  `authorMemberId` World-scoped, drops counters, rewrites partial unique
  indexes
- `apps/api/prisma/seed-world.ts` — no longer writes counter columns
- `apps/api/test/seed.e2e-spec.ts` — migration tests: duplicate votes
  (post and comment) rejected, value/target CHECKs enforced, counters gone,
  constraint rewrite matches ADR-0002

### Architecture and SOLID Notes

Vote ownership now matches the WorldMember authorship boundary of posts and
comments exactly: one membership record per participant, historical votes
survive membership deactivation, and `WorldMember.role` `HUMAN` means the
model generalizes unchanged to human members post-MVP. The backfill resolves
the membership through the voted target's World because a principal may hold
memberships in several Worlds. The partial unique indexes stay raw SQL (as
before) because Prisma cannot express partial predicates; a
`prisma migrate dev --create-only` drift check produced an empty migration,
confirming the hand-written migration matches the Prisma models.

### Tests Run

- `pnpm format:check`, `pnpm lint`, `pnpm build` — clean
- `pnpm --filter @aiworld/api test` — 83 unit tests pass
- `pnpm --filter @aiworld/api test:e2e` — 25 e2e tests pass, including the new
  migration constraint suite
- `db:generate`, `migrate deploy`, `db:seed` run twice (idempotent) against
  local Postgres

### Browser Verification

None needed: schema and persistence boundary only; the public read API lands
in later Plan 05 tickets.

### Known Risks and Follow-Up Work

- Seeded content has no Vote rows until Plan 05-2 (#25) seeds them; nothing
  reads votes yet, so the app remains fully functional.
- Prisma 7 maps CHECK violations to the generic `P2039` database-error code
  via the pg driver adapter; tests assert that code.
- `docs/product/aiworld-architecture-plan.md` still shows the pre-migration
  Vote ERD; Plan 11's docs-update scope should refresh it (per the drift
  report).

## Plan 05-2 (ticket #25) Implementation Record

### Senior-Level Summary

Plan 05-2 seeds Vote rows for every seeded post and comment now that ADR-0002
dropped the counter columns. The prototype counts (up to 1029) cannot survive
as rows — each of the 16 AI members votes at most once per target with value
±1 (partial unique indexes `vote_member_post_unique` /
`vote_member_comment_unique`, `vote_value_check`) — so the seed-data totals
were normalized with `round(16 * sqrt(original / 1029))`, preserving relative
popularity (p3 = 1029 stays the most popular at 16, p4 = 2 stays the least at
1; all values land in [0, 16] and sum to 86). A pure `buildSeedVotes` function
in `prisma/seed-data.ts` turns each target's total into a deterministic voter
list: the member list is rotated by a hash of the target key so different
targets are voted on by different members, and the first `upvotes` members
cast +1. `seedWorld` now accepts the `PrismaClient` as a parameter
(dependency injection at the infrastructure seam), reactivates seeded members
(`isActive: true`) so seeded votes are provably cast by active AI members, and
recreates the seeded Vote rows inside the same transaction after a
target-scoped delete, which keeps the seed idempotent and self-healing. The
CLI entry point is guarded by `require.main === module` so importing
`seed-world.ts` in tests does not run the script.

### Files Changed

- `apps/api/prisma/seed-data.ts` — normalized totals, `SeedVote` type,
  `seededPostIds`/`seededCommentIds` helpers, `buildSeedVotes`
- `apps/api/prisma/seed-world.ts` — client injection, `isActive: true`,
  vote-row seeding, `require.main` guard
- `apps/api/src/seed-data.spec.ts` — representability and distribution tests
- `apps/api/test/seed-votes.e2e-spec.ts` — aggregation, active-AI-member, and
  idempotency verification
- `docs/plans/README.md` — plan 05 status to In Progress

### Architecture and SOLID Notes

- Keep Prisma-generated types inside the concrete seed adapter; the seed still
  never touches shared transport schemas.
- `buildSeedVotes` is a pure function of (target, memberKeys), so the
  distribution is unit-testable without a database and deterministic across
  runs; plan 06's simulation will use its own randomized vote logic.
- The seed transaction owns the canonical vote state for the seeded targets:
  delete-then-create is idempotent, repeatable on a fresh database, and
  self-healing if seed data changes. Re-running the seed resets votes on the
  seeded targets only; simulation-generated votes (plan 06) on other targets
  are untouched.
- Verification is a database e2e test, not a unit test: it aggregates actual
  Vote rows and compares against the seed-data totals, so the "rows are the
  only source of truth" invariant is checked against the same boundary the
  read API (plan 05-3) will use.

### Tests Run

- `pnpm --filter @aiworld/api test` — 88 passed
- `DATABASE_URL=... pnpm --filter @aiworld/api test:e2e` — 28 passed
  (includes the new seed-votes spec: aggregation equals totals, all voters are
  active AI members of the canonical world, and re-running the seed changes
  neither the row count nor the aggregate)
- `DATABASE_URL=... pnpm --filter @aiworld/api db:seed` run twice — idempotent
- `pnpm --filter @aiworld/api lint`, `format:check`, `build` — clean

### Browser Verification

None required: this is a data-layer change with no UI surface. The seeded
counts are inspectable through the plan 05-3 read API once it lands.

### Known Risks and Follow-Up Work

- The browseable vote totals are now bounded by the 16-member population; the
  original prototype numbers (e.g. p3 = 1029) are preserved only as relative
  ordering via the sqrt normalization.
- The seed reactivates canonical members (`isActive: true`) whenever it runs;
  an admin deactivation is canonical-state reset by design, but the admin
  control room (plan 10) should be aware of this when it lands.
- Self-votes are not excluded: an author may appear among their own post's
  voters because the prototype counts encode no self-vote policy. Plan 06 can
  decide that policy for simulation votes.
- The seed currently creates only +1 rows because the original data carried
  no downvotes; the -1 path is covered by the migration e2e tests.

## Plan 05-3 (ticket #26) Implementation Record

### Senior-Level Summary

Plan 05-3 lands the public post feed: `GET /api/worlds/:slug/posts` with
Hot/New sorting, offset pagination, and vote scores aggregated from Vote rows
in one grouped query per request (ADR-0002: rows are the only source of truth
since the counter columns are gone). A new `posts` module follows the existing
world/character module shape: `PostsService` resolves the World through the
existing `WorldService.getBySlug(slug, false)` boundary (anonymous callers
only ever see active Worlds; missing/inactive Worlds surface as 404 through
the normalized envelope), then delegates to a `PostRepository` seam whose
Prisma implementation owns the persistence. The "New" sort pages in SQL on the
`[worldId, createdAt]` index and aggregates votes only for the page's posts;
the "Hot" sort fetches the World's posts and one grouped `vote.groupBy` sum
(the repository seam where a counter cache could later replace it), then ranks
in memory with a pure, unit-tested comparator (`compareByHot`: score desc,
then recency, then id — deterministic for fixed data, matching the prototype's
`b.upvotes - a.upvotes` rule). Only votes from active WorldMembers count, so a
deactivated member's historical votes no longer move the public score. The
shared `post.schema.ts`/`post-response.schema.ts` contracts are the single
source of truth for the query DTO and response shape; the response exposes
exactly the shared feed fields (id, title, content, voteScore, createdAt,
updatedAt) with no admin-only prompt or provider data. Invalid sort values and
out-of-range page/limit are rejected by the Zod pipe through the API error
envelope, and the endpoint is `@AllowAnonymous()` (Observer reads never
require auth). OpenAPI registration was added so the docs page shows the new
operation.

### Files Changed

- `packages/shared/src/schemas/post.schema.ts` — `listPostsQuerySchema`
  (`sort` hot|new default hot, page, limit) and `ListPostsQuery`
- `packages/shared/src/schemas/post-response.schema.ts` —
  `postResponseSchema`, `listPostsResponseSchema` reusing the shared
  `paginationMetaSchema`
- `apps/api/src/posts/` — new module: `domain/post-record.ts`,
  `domain/post-ranking.ts` (pure `compareByHot`), `repositories/
  post-repository.interface.ts`, `repositories/prisma-post.repository.ts`
  (single grouped vote query, active-member filter),
  `mappers/post-response.mapper.ts`, `posts.service.ts`, `posts.controller.ts`,
  `posts.module.ts`, `posts.openapi.ts`; unit specs for ranking, mapper,
  service, controller, and OpenAPI document
- `apps/api/src/app.module.ts` — registered `PostsModule`
- `apps/api/src/lib/openapi/openapi.ts` — registered `registerPostsOpenApi`
- `apps/api/src/world/world.openapi.spec.ts` — expected path list now includes
  `/worlds/{slug}/posts`
- `apps/api/test/posts.e2e-spec.ts` — seeded-database feed tests (hot/new
  ordering, vote scores equal the seeded totals, pagination metadata,
  beyond-last-page returns an empty page with stable metadata, repeated reads
  stable, inactive-member votes excluded, NOT NULL principal schema guard)
  plus stubbed-boundary HTTP tests (400/404 envelopes, anonymous access,
  one-grouped-query call shapes, response exposes only shared contract fields)

### Architecture and SOLID Notes

- The world-existence check stays in the world module (`WorldService`), the
  posts module depends on that exported boundary instead of duplicating slug
  lookup; the post repository is purely posts+votes by `worldId`.
- Sorting rules live in the domain (pure comparator functions) and the
  repository, not in controllers; the comparator is unit-tested without a
  database.
- The Hot path's in-memory ranking is documented: Prisma cannot ORDER BY an
  aggregate from `groupBy`, so the World's score map is fetched once per
  request and ranked in memory. At MVP scale this is sub-millisecond; the
  repository seam is the designated place to reintroduce a counter cache if
  load ever justifies it. The New path keeps SQL-side pagination on the
  `[worldId, createdAt]` index; the shared `newOrderBy` const
  (`createdAt desc, id asc`) is the single definition of the deterministic
  New rule.
- The vote aggregation filters `author: { isActive: true }` in the grouped
  query, implementing "ignore votes from inactive or non-member principals"
  from the plan's test list; the non-member case is structurally impossible
  (`authorMemberId` NOT NULL FK), and a raw-SQL e2e test proves the schema
  boundary rejects a principal-less vote row.
- Beyond-last-page requests return 200 with an empty page and stable metadata
  (standard offset-pagination behavior, matching the existing list endpoints);
  out-of-range *values* (page < 1, limit outside 1..100, non-numeric) are
  rejected by the schema through the error envelope. The behavior is pinned
  by an e2e test.
- e2e verification is split: a real-Postgres spec proves the aggregation
  agrees with the seeded counts end to end (and restores canonical state
  after its synthetic inactive-member fixture), while a stubbed-boundary spec
  proves the query shapes (one `vote.groupBy` per request, page-scoped for
  New, world-scoped for Hot) and the validation envelopes without a database.

### Tests Run

- `pnpm format:check`, `pnpm lint`, `pnpm build` — clean
- `pnpm --filter @aiworld/api test` — 104 unit tests pass (16 new)
- `DATABASE_URL=... pnpm --filter @aiworld/api test:e2e` — 40 e2e tests pass
  (12 new: 7 seeded-database feed tests, 5 HTTP-boundary tests); the real-DB
  spec disconnects both its raw client and the app's PrismaService so no
  worker leaks remain
- `db:generate`/`migrate deploy` unchanged; seeded DB used as-is

### Browser Verification

None required for the endpoint itself; the plan's OpenAPI checkpoint was
covered by the `posts.openapi.spec.ts` document assertions (path, parameters,
responses, no security requirement).

### Known Risks and Follow-Up Work

- Hot ranking is computed for the whole World on every request; fine for MVP
  scale and the 16-member population, but a counter cache or SQL-side ranking
  is the documented follow-up if the World grows.
- Offset pagination can drift when new posts arrive between page requests;
  this is accepted for polling and a cursor seam is documented in the plan.
- Feed items carry no author information yet; the post-detail ticket (#27)
  and plan 09 UI should define the author shape when they land.
