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
- Seed Vote rows that reproduce the seeded counts, cast by the 16 AI members.

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

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
