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

## Plan 05-4 (ticket #27) Implementation Record

### Senior-Level Summary

Plan 05-4 lands the post detail read: `GET /api/worlds/:slug/posts/:postId`
returns the post with its aggregated vote score, its author identity, and the
embedded comment tree bounded at three levels of nesting. The author shape is
now defined (the follow-up noted in the 05-3 record): a public `AuthorRecord`
of the authoring WorldMember's Character (`id`, `handle`, `name`,
`avatarUrl`), carried by a new `comments` module. The module owns the comment
read model (`FlatCommentRecord`), a pure, unit-tested `buildCommentTree`
domain function that assembles siblings deterministically (createdAt asc, id
asc) and stops recursion at `MAX_COMMENT_DEPTH = 3` — deeper comments are
dropped from the response while top-level comments are never lost, exactly
the "read-side safety stop" the plan describes (write-side enforcement is
Plan 06's). The comment tree lives in the response as a recursive shared
schema (`commentResponseSchema` via `z.lazy`) that validates at any depth,
while the OpenAPI document mirrors the bounded three-level shape because
zod-to-openapi cannot transform recursive schemas (its optional/nullable
probes safeParse every schema and overflow the error formatter on circular
ones; documented in the registrar).

Missing or character-less authors resolve safely instead of erroring: a
WorldMember with no Character (HUMAN role) maps to `author: null`, and
inactive members keep their identity intact — both covered by real-database
e2e tests. "Deleted targets never surface" holds structurally: posts and
comments have no soft-delete state; deletion is hard (cascade), so a deleted
target is simply absent and reads as 404, and the Vote/author FKs use
`onDelete: Restrict` so orphaned vote rows cannot appear. The controller now
validates the `postId` path parameter through the shared
`postDetailParamsSchema` (zod uuid), so malformed ids return the 400
validation envelope instead of a raw 500 from the database. The two
repositories share the vote aggregation (ADR-0002 grouped COUNTs, active
member filter) via `apps/api/src/votes/vote-aggregation.ts` and the author
select via `contentAuthorSelect`, since both posts and comments reads
aggregate scores — plan 05-5 and 05-6 reuse the same helpers.

Test hygiene: the new e2e spec is hermetic — it plants its own synthetic
fixture world (with votes from distinct members, respecting the partial
unique indexes) and never seeds or mutates the canonical world, so parallel
workers that assert the exact seeded feed are unaffected. The suite itself
was intermittently flaky under parallel workers against the shared Postgres
(even before this ticket: concurrent `seedWorld` interactive transactions
timed out and force-exited workers left residue that compounded), so the e2e
jest config now runs with `maxWorkers: 1`; the full 53-test suite passes
deterministically across repeated runs.

### Files Changed

- `packages/shared/src/schemas/author-response.schema.ts` — public author
  identity contract
- `packages/shared/src/schemas/comment-response.schema.ts` — recursive
  comment tree contract (`z.lazy`)
- `packages/shared/src/schemas/post-response.schema.ts` —
  `postWithAuthorResponseSchema`, `postDetailResponseSchema`
- `packages/shared/src/schemas/post.schema.ts` — `postDetailParamsSchema`
- `apps/api/src/comments/` — new module: `domain/comment-record.ts`,
  `domain/comment-tree.ts` (pure builder, `MAX_COMMENT_DEPTH`),
  `repositories/comment-repository.interface.ts`,
  `repositories/prisma-comment.repository.ts`,
  `repositories/content-author-select.ts`, `mappers/comment-response.mapper.ts`,
  `comments.module.ts`; unit specs for the tree builder and mapper
- `apps/api/src/votes/vote-aggregation.ts` — shared grouped vote-score
  helpers (posts and comments)
- `apps/api/src/posts/` — `findById` on repository/service/controller,
  `post-detail` OpenAPI registration (bounded doc mirror), param validation,
  updated unit specs
- `apps/api/src/app.module.ts` — registered `CommentsModule`
- `apps/api/test/post-detail.e2e-spec.ts` — hermetic fixture-world e2e
  (author identity, tree hierarchy, vote aggregation, three-level cap,
  inactive-author identity, character-less author, wrong-world/missing-post
  ​404s, malformed postId 400) plus stubbed-boundary HTTP tests (query
  shapes, contract-only fields, anonymous access)
- `apps/api/test/jest-e2e.json` — `maxWorkers: 1` (serial shared-DB suite)
- `apps/api/src/world/world.openapi.spec.ts`, `posts.openapi.spec.ts` —
  expected path lists

### Architecture and SOLID Notes

- The comment tree is assembled at the service boundary from flat repository
  rows (one grouped vote query per entity per request, no N+1); sorting and
  depth rules live in the pure domain function, not in controllers or
  React. The repository seam remains the designated place for a counter
  cache if load ever justifies it.
- The author select and vote aggregation are shared across the posts and
  comments repositories, so plan 05-5/05-6 add methods without duplicating
  the grouped COUNT logic.
- The recursive shared schema and the bounded doc mirror deliberately
  diverge: validation always accepts any depth (the API bounds it), while
  the OpenAPI document describes the actual three-level read contract.
- `PostDetailRecord` composes `PostWithAuthorRecord` (repository seam) with
  the tree built by the service; mappers stay thin and are unit-tested.

### Tests Run

- `pnpm format:check`, `pnpm lint`, `pnpm build` — clean
- `pnpm --filter @aiworld/api test` — 120 unit tests pass (15 new)
- `DATABASE_URL=... pnpm --filter @aiworld/api test:e2e` — 53 tests pass,
  run three times consecutively (suite is deterministic under
  `maxWorkers: 1`); 13 new post-detail tests
- Seeded DB verified clean of residue after repeated crashed runs

### Browser Verification

None required for the endpoint itself; the OpenAPI document assertions cover
the new path (`/worlds/{slug}/posts/{postId}`), its params, and its
responses.

### Known Risks and Follow-Up Work

- Comments nested deeper than level 3 are silently omitted from the
  response (the documented read-side cap); a truncation marker or count is
  possible follow-up if the UI needs to signal it. Plan 06 owns write-side
  depth enforcement.
- The OpenAPI document mirrors the bounded tree with `z.any()` at the leaf
  because the generator cannot express recursive schemas; if the doc ever
  needs exact leaf typing, upgrade the zod-to-openapi integration.
- `author: null` covers HUMAN members for now; plan 09 UI should render a
  neutral identity for them. Feed items (plan 05-3) still carry no author;
  extending the feed contract is a possible follow-up for the plan 09 UI.
- The e2e suite is now serial (`maxWorkers: 1`); if the suite grows large,
  a shared pre-seeded database fixture would let it parallelize again.

<<<<<<< HEAD
## Plan 05-5 (ticket #28) Implementation Record

### Senior-Level Summary

Plan 05-5 lands the character activity read: `GET
/api/characters/:characterId/activity?worldSlug=...` lists a character's
posts and comments in one World with vote scores aggregated from Vote rows,
reusing the vote helpers and author select from plan 05-3/05-4. A new
`activity` module composes five existing boundaries — `WorldService`
(active-World resolution, anonymous callers only ever see active Worlds),
`CharacterRepository`, `WorldMemberRepository`, `PostRepository`, and
`CommentRepository` — each extended with one new method. The response is
**unpaginated** by decision: a single character's own content in one World
is bounded, and the shared `characterActivityResponseSchema` carries both
lists in full (`posts` as `postWithAuthorResponseSchema[]`, `comments` as
`commentResponseSchema[]` with `replies: []`, since activity comments are
always flat).

The active state never blocks the read. The service resolves the character
through `CharacterRepository.findById(characterId)` with **no active
filter** (deliberately not `CharactersService.getById`, which forces
`isActive: true`), and the membership lookup
(`WorldMemberRepository.findByWorldAndCharacter`) carries no active filter
either — inactive characters and inactive memberships keep their public
content and identity intact, exactly the "missing authors, deleted targets,
and inactive characters have safe behavior" guarantee from the plan's test
list. A character with no membership in the requested World resolves to a
well-defined empty activity (`{ posts: [], comments: [] }`, 200) rather
than 404 or a leak of another World's content; only a missing World or a
missing character returns the 404 envelope. The comment query is
World-scoped **through the post relation** (`where: { authorMemberId,
post: { worldId } }`), so the same reusable Character in two Worlds only
ever surfaces the requested World's comments. `PostsModule` now exports
`PostRepository` and `PostResponseMapper` (previously exported nothing);
`CommentsModule` and `WorldMembersModule` already exported what activity
needs. OpenAPI registration was added; as in 05-4, the document mirrors the
flat activity comment shape because zod-to-openapi cannot transform the
recursive shared `commentResponseSchema` (verified: registering the real
schema overflows the generator with a stack overflow).

### Files Changed

- `packages/shared/src/schemas/activity.schema.ts` —
  `activityParamsSchema` (`characterId` uuid), `activityQuerySchema`
  (`worldSlug`), `ActivityParams`, `ActivityQuery`
- `packages/shared/src/schemas/activity-response.schema.ts` —
  `characterActivityResponseSchema`, `CharacterActivityResponse`
  (unpaginated)
- `apps/api/src/activity/` — new module: `domain/activity-record.ts`,
  `mappers/activity-response.mapper.ts`, `activity.service.ts`,
  `activity.controller.ts`, `activity.module.ts`, `activity.openapi.ts`;
  unit specs for the service, controller, mapper, and OpenAPI document
- `apps/api/src/posts/repositories/` — `findByAuthorMembership(worldId,
  authorMemberId)` on the interface and Prisma implementation (posts scoped
  by `worldId + authorMemberId`, one grouped post-vote query)
- `apps/api/src/comments/repositories/` — `findByAuthorMembership(worldId,
  authorMemberId)` on the interface and Prisma implementation (World-scoped
  via the post relation, one grouped comment-vote query)
- `apps/api/src/world-members/repositories/` — new
  `findByWorldAndCharacter(worldId, characterId)` (selects only the member
  id) on the interface and Prisma implementation
- `apps/api/src/posts/posts.module.ts` — exports `PostRepository` and
  `PostResponseMapper`
- `apps/api/src/world-members/world-members.service.spec.ts` — mock gains
  the new repository method
- `apps/api/src/app.module.ts` — registered `ActivityModule`
- `apps/api/src/lib/openapi/openapi.ts` — registered
  `registerActivityOpenApi`
- `apps/api/src/world/world.openapi.spec.ts` — expected path list now
  includes `/characters/{characterId}/activity`
- `apps/api/test/character-activity.e2e-spec.ts` — hermetic fixture-world
  e2e (worlds `activity-fixture` and `activity-fixture-b`; author content
  with vote scores, other-character content excluded, World-scoping for the
  same reusable Character, inactive character and inactive membership still
  listed with identity, no-membership empty activity, 404 envelopes for
  missing character/world, anonymous access) plus stubbed-boundary HTTP
  tests (contract-only fields, query shapes scoped through worldId +
  authorMemberId and the post relation, one grouped vote query per entity,
  empty membership activity, 404 envelopes, missing `worldSlug` 400)

### Architecture and SOLID Notes

- The activity service composes existing exported boundaries; it adds no
  persistence of its own. The `characterId`-scoped lookup stays in the
  character module, the world-existence check stays in the world module,
  and the new repository methods own the persistence.
- The response is unpaginated by recorded decision: a character's own
  posts and comments in one World are bounded; the plan's API intent is
  preserved without cursor machinery. If a World ever grows unbounded
  author content, the repository seam is the place to add paging.
- The active state is a *write-side* gate, not a read-side one: historical
  public content of deactivated characters and memberships remains
  readable with identity intact (consistent with 05-4's inactive-author
  behavior). Votes on that content still aggregate from Vote rows (active
  voter filter per ADR-0002).
- The membership seam returns only `{ id }`: the activity read needs just
  the member id to scope the content queries, and returning the full record
  would carry world slug data the read model must not surface.
- The comment query is World-scoped via `post: { worldId }` rather than a
  join to the comment's own world: comments have no direct World reference,
  so the relation filter is the single place the scope is enforced.
- Ordering is deterministic (createdAt desc, id desc) for both lists; the
  e2e fixtures pin the order.
- As in 05-4, the recursive shared `commentResponseSchema` cannot be
  transformed by zod-to-openapi (stack overflow), so the activity document
  mirrors the flat contract: comments with `replies: z.array(z.any())`
  (the API always returns `[]`). The shared schema remains the validation
  contract.
=======
## Plan 05-6 (ticket #29) Implementation Record

### Senior-Level Summary

Plan 05-6 lands the world-scoped discussion search: `GET
/api/worlds/:slug/search?q=...` returns matching posts (title or content)
and comments (content) scoped to that World, merged into one paginated list
whose items are tagged with their type (`{ type: 'post', post }` /
`{ type: 'comment', comment }`) so the Plan 09 dropdown UI can render the
correct shape per row from a single coherent pagination metadata. The
`search` module follows the established shape: `SearchService` resolves the
World through `WorldService.getBySlug(slug, false)` (404 for missing or
inactive Worlds via the controller's `NotFoundException`), then delegates to
new `searchByText` methods on the existing `PostRepository` and
`CommentRepository` seams. World-scoping is structural, not filtered after
the fact: posts match with `where: { worldId, OR: [title/content contains] }`
and comments match with `where: { content: contains, post: { worldId } }` —
a comment belongs to a World exactly when its post does, which is the
no-leak guarantee. Both queries aggregate vote scores with the shared
all-matches `aggregatePostVoteScores`/`aggregateCommentVoteScores` grouped
COUNTs (active-member filter), like the Hot path, rather than page-scoped
aggregation.

The merged list is sorted deterministically by a pure domain comparator
(`compareSearchResults`: createdAt desc, then id desc — both record shapes
carry createdAt and id), sliced in the service for pagination, and mapped at
the response boundary through the existing `PostResponseMapper` and
`CommentResponseMapper`, so no admin-only prompt or provider data can leak.
Comments in search results are flat (`replies: []`): search reads never
resolve thread context. Safe-empty behavior is defined at the service: a
query whose trimmed length is under two characters (absent, empty,
whitespace, or single-character `q` — `q` is optional in the shared
`searchQuerySchema`) returns an empty page with zero metadata instead of an
error, and a no-result query does the same. The response validates through
the shared `searchResponseSchema` (a discriminated union of the existing
post-with-author and comment contracts), the endpoint is
`@AllowAnonymous()` (Observer reads never require auth), and OpenAPI
registration was added with a bounded comment mirror because
zod-to-openapi cannot transform the recursive `commentResponseSchema` (see
the note in `posts.openapi.ts`).

### Files Changed

- `packages/shared/src/schemas/search.schema.ts` — `searchQuerySchema`
  (`q` optional, page/limit with the shared defaults) and `SearchQuery`
- `packages/shared/src/schemas/search-response.schema.ts` —
  `postSearchResultSchema`, `commentSearchResultSchema`,
  `searchItemSchema` (discriminated union), `searchResponseSchema` reusing
  the shared `paginationMetaSchema`, plus their types
- `apps/api/src/posts/repositories/post-repository.interface.ts` +
  `prisma-post.repository.ts` — `searchByText(worldId, q)`:
  `post.findMany` with the `worldId` + title/content OR match on
  `postWithAuthorSelect`, ordered createdAt desc / id desc, one grouped
  vote query for all matches
- `apps/api/src/comments/repositories/comment-repository.interface.ts` +
  `prisma-comment.repository.ts` — `searchByText(worldId, q)`: comment
  content match scoped through `post: { worldId }` (the no-leak
  guarantee), same ordering and single grouped vote query
- `apps/api/src/posts/posts.module.ts` — exports `PostRepository` and
  `PostResponseMapper` so the search module can consume the seams
- `apps/api/src/search/` — new module: `domain/search-record.ts`
  (`SearchResultRecord` union + pure `compareSearchResults`),
  `search.service.ts`, `search.controller.ts` (GET, `@AllowAnonymous`,
  `ZodValidationPipe`), `mappers/search-response.mapper.ts`,
  `search.module.ts`, `search.openapi.ts` (bounded comment doc mirror);
  unit specs for the service, controller, mapper, and OpenAPI document
- `apps/api/src/app.module.ts` — registered `SearchModule`
- `apps/api/src/lib/openapi/openapi.ts` — registered `registerSearchOpenApi`
- `apps/api/src/world/world.openapi.spec.ts` — expected path list now
  includes `/worlds/{slug}/search`
- `apps/api/test/search.e2e-spec.ts` — hermetic fixture-world e2e (title
  and content matches, comment matches, vote scores, deterministic merge
  order, other-World content never appears, empty/short/no-result safe
  responses, shared pagination metadata, anonymous access) plus
  stubbed-boundary HTTP tests (contract-only fields with type tags, query
  shapes incl. the post-relation comment scope, no repository calls for
  absent/short queries, 404 envelope, validation 400s)

### Architecture and SOLID Notes

- The world-existence check stays in the world module; the search service
  depends on `WorldService` plus the two exported repository seams, and
  the merge/sort/slice rules live in the service and a pure domain
  comparator, not in the controller or React.
- The merged single-list design with type tags keeps one pagination
  contract for mixed content — the alternative (separate post and comment
  pages) would force the Plan 09 dropdown to reconcile two pagination
  cursors. The discriminated union in the shared schema validates the tag
  and shape together.
- Comments are World-scoped through the `post` relation in SQL, so a
  comment can never match unless its post is in the World; this is
  stronger than filtering by author membership because it uses the same
  ownership boundary as every other content read.
- Vote aggregation is all-matches (world-scoped), mirroring the Hot path,
  not page-scoped like the New path: search returns a merged ranking page,
  so scores must be stable across pages of one query.
- Search repositories fetch every match and slice in memory (like Hot);
  `ILIKE '%q%'` cannot use a B-tree index anyway. A future FTS/trigram
  upgrade slots into the same repository seam.
- The min-two-characters rule is a service decision (query validation
  would otherwise 400 a legitimately empty search box); the response is
  still a well-defined empty page through the shared contract.
>>>>>>> 5c34093 (feat(api): add world-scoped discussion search)

### Tests Run

- `pnpm format:check`, `pnpm lint`, `pnpm build` — clean
<<<<<<< HEAD
- `pnpm exec tsc --noEmit -p apps/api/tsconfig.json` (run inside
  `apps/api`) — clean
- `pnpm --filter @aiworld/api test` — 135 unit tests pass (15 new)
- `DATABASE_URL=... pnpm --filter @aiworld/api test:e2e` — 70 tests pass
  (suite is deterministic under `maxWorkers: 1`); 17 new activity tests
  (11 real-database, 6 HTTP-boundary)
- Seeded DB verified clean of residue after the activity e2e run (no
  `activity-*` worlds or characters remain)
=======
- `pnpm --filter @aiworld/api test` — 141 unit tests pass (21 new: 11
  search service, 3 controller, 3 mapper, 4 OpenAPI document)
- `DATABASE_URL=... pnpm --filter @aiworld/api test:e2e` — 69 tests pass
  (16 new: 11 real-database fixture-world, 5 HTTP-boundary); the hermetic
  spec cleans both fixture slugs and its characters in afterAll, and a
  residue probe confirmed the shared DB is clean
- `pnpm exec tsc --noEmit -p tsconfig.json` — clean
- Postgres `migrate deploy` — no pending migrations; seeded DB used as-is
>>>>>>> 5c34093 (feat(api): add world-scoped discussion search)

### Browser Verification

None required for the endpoint itself; the OpenAPI document assertions
<<<<<<< HEAD
cover the new path (`/characters/{characterId}/activity`), its
`characterId` path param, its `worldSlug` query param, and its 200/400/404
responses.

### Known Risks and Follow-Up Work

- Activity is unpaginated by design; a future "more content per author"
  World should revisit paging at the repository seam.
- Feed items (plan 05-3) still carry no author; extending the feed
  contract to match the activity/detail author shape is still open for the
  plan 09 UI.
- The e2e suite remains serial (`maxWorkers: 1`); the shared pre-seeded
  database fixture idea from the 05-4 record still applies if it grows.
- Review follow-up: the `characterId` path param now validates through the
  shared `activityParamsSchema` (400 envelope for malformed ids, matching
  the 05-4 `postId` behavior), the inactive-membership semantics comment
  was corrected to match the pinned behavior (inactive memberships keep
  their content), the OpenAPI document reuses the shared
  `postWithAuthorResponseSchema` for posts, and e2e now covers the
  inactive-World 404 and missing-`worldSlug` 400 cases.

=======
cover the new path (`/worlds/{slug}/search`), its params (slug, q, page,
limit), its responses (200/400/404), and the absence of a security
requirement.

### Known Risks and Follow-Up Work

- Search is `ILIKE` substring matching over title/content; no stemming,
  ranking by relevance, or full-text features. Fine for MVP scale; the
  repository seam is the place for a trigram/FTS upgrade, and Plan 09
  should keep result ordering purely recency-based.
- Comment results are flat and carry no post reference, so the UI cannot
  jump from a search hit to its thread context without the post id; adding
  `postId` to the comment item is a possible follow-up if the dropdown
  needs it.
- All-matches aggregation means the whole World's matching rows are
  fetched per request; fine at MVP scale, and a counter cache (the
  documented seam) or FTS with scores would change that.
- Vote scores are computed over all matches, so totals in the page metadata
  are match counts, not score sums; the Plan 09 UI should not conflate the
  two.
>>>>>>> 5c34093 (feat(api): add world-scoped discussion search)
