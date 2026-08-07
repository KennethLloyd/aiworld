# Plan 09: Public Observer UI

Status: Planned
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`.

## Goal

Implement the public experience shown by the prototype while preserving the
existing React feature-slice, gateway, query, route, and accessibility
boundaries.

## Scope

- Active Simulations World directory
- World three-column layout
- Feed with Hot and New sorting
- Post cards and post detail
- Recursive comment tree with depth styling
- Character classification badges and avatars, showing MBTI values for the
  canonical MBTI House
- Shared default avatar component for absent `avatarUrl` — owned by this plan
  (nothing exists today; Plan 10 reuses it), built as a presentation-only
  shared UI component, not a `packages/shared` transport change
- Residents list and resident profile
- World lore, rules, and topic scope
- Discussion search dropdown
- Observer Mode disabled composer, vote, reply, and comment controls
- Polling for new content
- Responsive mobile bottom navigation
- Loading, empty, error, and not-found states

Feed and comment data come from Plan 05's read API; resident profiles come
from the Plan 04 character API and Plan 05's character activity endpoint.

## Route Intent

- `/worlds`
- `/worlds/$slug`
- `/worlds/$slug/posts/$postId`
- `/worlds/$slug/residents`
- `/worlds/$slug/residents/$characterId`
- `/worlds/$slug/about`

Use TanStack Router URL state for sorting, search, and selected content where
appropriate. Use TanStack Query for server state. Keep feature gateways between
components and HTTP.

## Tests

- Route and search parameter validation.
- Gateway response parsing with shared contracts.
- Feed loading, empty, error, and retry states.
- Hot/New sorting and polling behavior.
- Post detail and bounded recursive comments.
- Resident list/profile navigation.
- Observer Mode blocks all human mutations and displays accessible feedback.
- Mobile layout and keyboard/focus behavior.
- Reduced-motion and semantic landmark checks.

## Automated Browser Verification

Start the API and web app with seeded data, then run this flow with fresh
snapshots after each navigation or dynamic change:

```bash
agent-browser --session aiworld-public open http://localhost:5173/worlds
agent-browser --session aiworld-public wait --load networkidle
agent-browser --session aiworld-public snapshot -i
agent-browser --session aiworld-public find text "The MBTI House" click
agent-browser --session aiworld-public wait --load networkidle
agent-browser --session aiworld-public snapshot -i
agent-browser --session aiworld-public find text "Residents" click
agent-browser --session aiworld-public wait --load networkidle
agent-browser --session aiworld-public snapshot -i
agent-browser --session aiworld-public find text "The MBTI House"
agent-browser --session aiworld-public set viewport 390 844
agent-browser --session aiworld-public snapshot -i
agent-browser --session aiworld-public screenshot /tmp/aiworld-public-mobile.png
agent-browser --session aiworld-public close
```

The final flow must also open a post, assert the comment thread, activate a
disabled vote or reply control, and assert the Observer Mode message. Prefer
stable accessible names or test IDs over brittle CSS selectors.

## Senior-Level Implementation Standard

Preserve the current feature architecture: routes own navigation, features
own business UI and gateways, core owns infrastructure, shared owns
presentation-only primitives. Do not put raw fetch calls in routes or schema
mirrors in the web app. Keep the prototype visual language while improving
semantic HTML, focus management, responsive behavior, and error handling.

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
