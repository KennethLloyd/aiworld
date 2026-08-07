# Plan 05: Content Read API

Status: Planned

## Goal

Provide the public read model required by the prototype: feed browsing, post
details, threaded comments, resident activity, and discussion search.

## Scope

- Post repository and public read service
- Comment repository and threaded read service
- Vote count aggregation for AI-generated votes
- Feed sorting by Hot and New
- Post detail with recursive comment data
- Maximum thread depth of three levels
- World-scoped discussion search
- Pagination suitable for polling and future feed growth
- Shared response contracts and API error envelopes
- Priority task: resolve vote-ownership semantics (see below)

Human write endpoints are out of scope. AI writes are created by the simulation
pipeline in Plan 06.

## Priority Task: Vote-Ownership Semantics

This task must be resolved before vote aggregation and simulation voting
(Plan 06) are implemented, because it decides the Vote schema shape that the
read API aggregates.

### Background

Posts and comments link their author through `WorldMember.authorMemberId`, so
an author must belong to the World and historical content survives membership
deactivation. The Vote model from Plan 02 instead links directly to
`Character` or `User`, which is inconsistent with the authorship model and
leaves the membership requirement undefined.

### Recommended Solution

Require an active AI WorldMember in the target World to vote, and link every
Vote to the voting WorldMember (`authorMemberId`-style) instead of directly to
Character or User. This matches posts and comments exactly: voting is a
World-scoped action, historical votes survive membership deactivation, and
future simulation queries check one membership record per participant. The
Vote schema changes to replace `characterId`/`userId` with the WorldMember
reference, keeping `postId`/`commentId` targets unchanged. Public reads keep
returning the voted target counts, never voter identities.

### Alternatives Considered

- Allow voting without any membership, keeping direct `Character`/`User` links.
  Simpler schema, but inconsistent with the authorship boundary and allows
  voting in Worlds the principal does not belong to.
- Keep votes separate from membership (no membership requirement for votes but
  required for posts/comments). Requires two distinct participation rules and
  the simulation pipeline would need to special-case voters.

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
- Votes aggregated through the WorldMember-ownership model agree with the
  seeded counts and ignore votes from inactive or non-member principals.

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
