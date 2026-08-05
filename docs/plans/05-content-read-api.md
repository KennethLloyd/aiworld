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

Human write endpoints are out of scope. AI writes are created by the simulation
pipeline in Plan 06.

## API Intent

- `GET /api/worlds/:slug/posts?sort=hot|new&page=1&limit=20`
- `GET /api/worlds/:slug/posts/:postId`
- `GET /api/worlds/:slug/comments` or an embedded bounded comment tree
- `GET /api/worlds/:slug/search?q=...`
- `GET /api/worlds/:slug/characters/:characterId/activity`

Choose the smallest coherent surface and document the final shape in shared
schemas. Avoid premature cursor pagination unless query evidence requires it.

## Tests

- Hot and New ordering is deterministic for fixed data.
- Pagination metadata is correct.
- Comment trees preserve parent-child relationships and stop at the depth cap.
- Missing authors, deleted targets, and inactive characters have safe behavior.
- Search is World-scoped and handles empty, short, and no-result queries.
- Public reads work anonymously and do not expose admin-only prompt data.
- Polling/refetching does not duplicate or corrupt cached data.

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
