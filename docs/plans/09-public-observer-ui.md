# Plan 09: Public Observer UI

Status: In Progress
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

Resident profiles show a merged Activity Timeline: the character's Posts and
Comments (nested replies flattened) in one chronological stream, newest first,
with per-type icons, vote scores, and click-through to post detail, driven by
the paginated character activity endpoint (issue #28, merged keyset cursor)
via TanStack Query `useInfiniteQuery` infinite scroll. Avatars and author
names are clickable on every surface (feed, post detail, comments, residents
grid, profile header) and navigate to the resident profile. Post cards render
the feed contract's `author` and `commentCount` (issue #36). Share copies the
post URL. Back navigation is asserted in the browser flow. The World
directory uses the prototype's landing copy and Live badge. The sidebar
"World Time" stat is an explicit non-goal: public observers receive no
simulation-clock projection (telemetry stays admin-only).

Feed and comment data come from Plan 05's read API; resident profiles come
from the Plan 04 character API and Plan 05's character activity endpoint.
The prototype `docs/product/aiworld_mvp.html` is the design source of truth
for every screen in this plan.

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
disabled vote or reply control, and assert the Observer Mode message. It must
also click Back after opening a post and a profile and assert return to the
previous screen, click an avatar or author name and assert the resident
profile opens, and scroll the Activity Timeline to assert the infinite-scroll
page fetch. Prefer stable accessible names or test IDs over brittle CSS
selectors.

## Senior-Level Implementation Standard

Preserve the current feature architecture: routes own navigation, features
own business UI and gateways, core owns infrastructure, shared owns
presentation-only primitives. Do not put raw fetch calls in routes or schema
mirrors in the web app. Keep the prototype visual language while improving
semantic HTML, focus management, responsive behavior, and error handling.

## Implementation Record

Status: In Progress (09-1 implemented on the ticket branch; PR #117 open)

### Senior-Level Summary

The public observer now has a prototype-aligned entry point and world frame.
The directory presents active simulations with Live status, while the world
screen composes the existing world gateway/query boundary with a responsive
three-column shell, observer-only context, and working Feed/Residents/About
section navigation. A shared presentation-only `Avatar` owns the missing or
broken image fallback so later Character and admin surfaces can reuse the same
visual contract. Public world list/detail queries refetch every 30 seconds so
the observer can receive updated snapshots without introducing a second client
state store. The route composes a validated latest-conversation snapshot from
the Posts feature so new content is observed on the same cadence; the full
feed experience remains in 09-2.

### Files Changed

- `apps/web/src/features/worlds/components/world-card.tsx` — prototype-aligned Live cards using API-backed world fields
- `apps/web/src/features/worlds/components/world-detail.tsx` — world detail and section targets mounted inside the observer shell
- `apps/web/src/features/worlds/components/world-layout.tsx` — responsive three-column frame with active section navigation
- `apps/web/src/features/worlds/components/world-list.tsx` — Active Simulations landing copy
- `apps/web/src/features/worlds/query/use-world.ts` and `use-worlds.ts` — 30-second public polling
- `apps/web/src/features/posts/` — feature-owned latest-conversation gateway, query, and snapshot panel
- `apps/web/src/providers/gateways-provider.tsx` and `apps/web/src/router/router.tsx` — one application-level adapter object shared by React and router composition
- `apps/web/src/shared/ui/avatar.tsx` — reusable default avatar fallback
- Focused route, query, and avatar specs

### Architecture and SOLID Notes

The change preserves the route → query → gateway → HTTP direction. The new
layout and avatar are presentation-only components; they do not import API
clients or transport schemas beyond the world response consumed by the
existing feature boundary. Polling is configured at the TanStack Query seam
and explicitly opted into by the public route, so admin detail and list
queries remain manual. The route composes the Posts snapshot at the feature
boundary, while Posts owns its endpoint, gateway, and query; core remains
feature-agnostic. The composition root exposes all adapters through one
application-level `AppGateways` context so future feature gateways do not add
one provider per feature. Later Plan 09 tickets replace the Character
placeholder and latest-feed snapshot with their full screens.

### Tests Run

- `apps/web`: `vitest run` — 24 files, 127 tests passed
- `apps/web`: `tsc --noEmit` — passed
- `apps/web`: `oxlint .` — passed
- `apps/web`: `oxfmt --check .` — passed
- `apps/web`: `vite build` — passed
- `git diff --check` — passed

### Browser Verification

Seeded PostgreSQL/Redis services and the API were started locally. The
`agent-browser` public flow verified `/worlds`, `/worlds/mbti-house`, the
three-column observer navigation, and the 390×844 mobile navigation. Clicking
the mobile About item produced `#about-world`; screenshot evidence was saved
to `/tmp/aiworld-public-mobile.png`.

### Known Risks and Follow-Up Work

- The full Hot/New feed, post detail, and Character query slices are delivered
  by later Plan 09 tickets; they should reuse the public 30-second cadence.
  Admin world lists explicitly remain manual and do not inherit public polling.
- GitHub Project status could not be changed because the local `gh` token lacks
  the `read:project` scope; issue #47 remains assigned and open for PR review.
