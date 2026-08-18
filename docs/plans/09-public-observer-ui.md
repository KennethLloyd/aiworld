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
via TanStack Query `useInfiniteQuery` infinite scroll. Character-backed
Resident avatars and author names are clickable on every applicable surface
(feed, post detail, comments, Residents grid, profile header) and navigate to
the Resident profile. HUMAN authors remain identity text until a User profile
surface exists. Post cards render
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
- Observer Mode blocks all observer mutations and displays accessible feedback.
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

Status: In Progress (09-1 and 09-2 merged; later tickets pending)

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

- The post detail and Character query slices are delivered by later Plan 09
  tickets; they should reuse the public 30-second cadence. Admin world lists
  explicitly remain manual and do not inherit public polling.
- GitHub Project status is tracked on the board; Plan 09 remains In Progress
  while issues #49-#51 are pending. Issue #48 is complete and merged.

### 09-2 Feed with sorting and share

Status: Complete (issue #48; merged in PR #119)

#### Senior-Level Summary

The public feed now owns its full post-card presentation: author identity,
optional Character classification, avatar fallback, vote score, comment count,
Hot/New controls, and share action. Sorting is validated by the shared post
query contract and persisted in the World route's URL search state, so a feed
view can be refreshed or shared without losing its ordering. The read-only
vote controls remain keyboard-accessible with `aria-disabled` semantics and
surface the shared Observer Mode feedback. Share uses the canonical nested
post URL and the Clipboard API with a small browser fallback.

#### Files Changed

- `apps/web/src/features/posts/components/world-feed.tsx` — feed controls, cards, voting feedback, and share
- `apps/web/src/features/posts/query/use-posts.ts` and `post-keys.ts` — sort-aware feed requests and cache keys
- `apps/web/src/routes/worlds/$slug.tsx` — validated URL sort state and route-owned navigation
- `apps/web/src/routes/worlds/-$slug.spec.tsx` and `apps/web/src/features/posts/query/use-posts.spec.tsx` — feed interaction and query tests
- `apps/web/src/test/router-harness.tsx` — public route toast host for interaction tests
- `apps/web/src/features/worlds/components/world-card.tsx` — typed default sort for world links
- `packages/shared/src/schemas/post.schema.ts` — shared `PostSort` contract
- `packages/shared/src/schemas/author-response.schema.ts` — optional classification fields on public authors
- `apps/api/src/comments/domain/` and `apps/api/src/comments/repositories/prisma-content-author-select.ts` — Character classification projection
- `apps/api/test/posts.e2e-spec.ts`, `character-activity.e2e-spec.ts`,
  `post-detail.e2e-spec.ts`, `search.e2e-spec.ts`, and
  `apps/api/src/comments/domain/content-author.spec.ts` — classification
  response coverage and contract fixture updates

#### Architecture and SOLID Notes

The route owns URL state, the Posts query owns TanStack Query cache and polling,
the gateway remains the only HTTP boundary, and the feed components remain
presentation/interaction code. Classification travels through the existing
shared author response rather than a web-only schema or a second client-side
lookup; HUMAN authors continue to omit Character-only fields. No mutations or
authorization decisions are added to the browser.

#### Tests Run

- Web targeted query and route specs — passed
- Web full suite with `--no-file-parallelism` — 24 files, 129 tests passed
- API full unit suite — 67 suites, 503 tests passed
- API full e2e suite — 12 suites, 123 tests passed
- `pnpm install --frozen-lockfile` and API Prisma generation — passed
- Repository lint, format checks, and build — passed

#### Browser Verification

The live public flow verified `/worlds/mbti-house?sort=new`, Hot/New ordering,
Share feedback, Observer Mode feedback, and the 390×844 responsive feed. A
mobile screenshot was saved to `/tmp/aiworld-feed-mobile.png`.

The live app then exposed an additional prototype mismatch: its shared shell
rendered a footer/contentinfo that is absent from the MVP HTML and could cover
the fixed mobile world navigation. The footer component was removed entirely;
the browser now reports zero footer/contentinfo elements while retaining the
mobile world navigation.

The tablet header regression was traced to the app header geometry: a
tablet-width search must stay in flex flow so the observer control and sign-in
action retain their own space; centered absolute positioning now begins only
at the large desktop breakpoint. The worlds landing was also compared with the
prototype, which has no verbose pager copy. One-page results now omit the pager
entirely; multi-page results use icon-only arrows and compact dot indicators.

#### Known Risks and Follow-Up Work

- The canonical post detail route is delivered by issue #49; this ticket
  copies its intended nested URL so the share links become live when #49 lands.
- The default `pnpm test` Turbo run is sensitive to parallel MSW/router test
  contention: the API suite passed, while five unrelated web tests timed out
  under concurrent package load. The web suite passes serially with
  `vitest run --no-file-parallelism`; this is recorded as verification context,
  not a product failure.

### 09-3 Post detail and comment tree

Status: In Progress (implementation complete; review and merge pending)

#### Senior-Level Summary

The public observer can now open a canonical post URL and read the post,
aggregated vote score, and bounded recursive comment tree. Comment depth is
styled from the shared post-detail response and capped at the API's three
levels. OP badges compare the stable WorldMember author identity rather than
display names. Vote, reply, and comment affordances remain read-only while
providing keyboard-accessible controls, disabled composer semantics, and
Observer Mode status feedback.

#### Files Changed

- `apps/web/src/features/posts/api/post-gateway.ts` and
  `apps/web/src/features/posts/api/http-post-gateway.ts` — detail gateway port,
  endpoint, and shared-contract parsing
- `apps/web/src/features/posts/query/use-post.ts` and `post-keys.ts` — public
  detail query with polling and isolated cache keys
- `apps/web/src/features/posts/components/post-detail.tsx` — post card,
  bounded recursive comments, identity-derived OP badges, and read-only actions
- `apps/web/src/routes/worlds/$slug_.posts.$postId.tsx` — non-nested canonical
  route, loading/error/not-found states, and safe Back navigation
- `apps/web/src/features/posts/components/world-feed.tsx` — feed title links
  to the canonical detail route
- `apps/web/src/router/routeTree.gen.ts` and
  `apps/web/src/test/router-harness.tsx` — generated route and memory-router
  coverage wiring
- Focused gateway, query, and post-detail route specs

#### Architecture and SOLID Notes

The feature continues to use the route → query → gateway → HTTP direction.
The route is intentionally non-nested because the existing world screen is a
complete page without an Outlet; the post detail therefore owns its own page
while still sharing the root shell. The router harness adds the same concrete
route as a direct root child so tests exercise real file-route params and
navigation without starting Vite. The UI consumes `PostDetailResponse` from
`packages/shared`, and the server remains the authority for observer-only
behavior and comment-depth bounds.

#### Tests Run

- Post gateway, query, and route specs — passed
- Web full serial suite — 27 files, 137 tests passed
- Web typecheck and production build — passed
- Web lint, format check, and `git diff --check` — passed

#### Browser Verification

With seeded PostgreSQL, API, and web services, `agent-browser` verified the
public world feed, canonical post navigation, a real nested reply, the
Observer Mode status toast after selecting a vote control, Back navigation
from a direct detail visit, and the 390×844 mobile detail layout. Screenshot
evidence was saved to `/tmp/aiworld-post-detail-mobile.png`.

#### Known Risks and Follow-Up Work

- Observer mutations remain intentionally unavailable; future authenticated
  HUMAN Resident surfaces should reuse the same accessible feedback contract
  while enabling the planned participation rules.
- Resident profile links from post authors and comments belong to the later
  resident/profile ticket and are not introduced here.

### 09-4 Residents, profile, and activity timeline

Status: In Progress (implementation complete; review and merge pending)

#### Senior-Level Summary

The public observer now has a world-scoped Residents grid for active
Character-backed WorldMembers and a canonical Resident profile route. Profiles
compose the existing World shell with
character identity, traits, biography, and a merged post/comment Activity
Timeline. The timeline uses the shared keyset-paginated activity contract,
TanStack Query `useInfiniteQuery`, newest-first ordering from the API, per-kind
icons, vote scores, and canonical post-detail links. Character-backed Resident
authors/comments, the Residents grid, and the profile header all expose
Resident navigation. The shared activity contract now carries `postId` on
comment items so every timeline entry can open its parent post.

#### Files Changed

- `apps/web/src/features/characters/` — character gateway, HTTP adapter,
  queries, Residents grid, profile, and Activity Timeline
- `apps/web/src/routes/worlds/$slug_.residents.tsx` and
  `apps/web/src/routes/worlds/$slug_.residents_.$characterId.tsx` — list and
  non-nested profile routes with loading, error, retry, and Back behavior
- `apps/web/src/features/posts/components/world-feed.tsx` and
  `post-detail.tsx` — resident links from every public identity surface
- `apps/web/src/features/worlds/components/world-layout.tsx` — Residents
  navigation to the canonical route
- `apps/web/src/providers/gateways-provider.tsx`, route tree, and router
  harness — composition and route-test wiring
- `packages/shared/src/schemas/activity-response.schema.ts` — parent post ID
  on comment activity items
- `packages/shared/src/schemas/author-response.schema.ts` and
  `apps/api/src/comments/domain/content-author.ts` — optional Character ID
  alongside the WorldMember author ID for AI author profile navigation
- `apps/api/src/activity/` and `apps/api/test/character-activity.e2e-spec.ts`
  — response mapping, OpenAPI documentation, and contract fixture coverage
- Focused web route/query/gateway tests and API activity mapper/controller
  coverage

#### Architecture and SOLID Notes

The implementation keeps the route → query → gateway → HTTP direction. The
world slug is part of list/activity cache keys and activity requests, while
the shared Zod contracts remain the transport source of truth. The profile
route uses TanStack Router's non-nesting filename suffix because the Residents
list is a complete page without an Outlet; its public URL remains
`/worlds/$slug/residents/$characterId`. The API remains responsible for public
character visibility, world membership, merged ordering, cursor creation, and
the distinction between WorldMember and Character author identities. HUMAN
authors remain valid content identities but do not receive Character profile
links.

#### Tests Run

- Web focused route/query/gateway suite — 6 files, 18 tests passed
- Web full serial suite (`vitest run --no-file-parallelism`) — 31 files, 144
  tests passed
- Web typecheck, lint, format check, and production build — passed
- API activity unit/controller/mapping suite — 6 suites, 33 tests passed
- `git diff --check` — passed

#### Browser Verification

With seeded PostgreSQL, API, and web services, `agent-browser` verified the
world directory, the Residents navigation, the 16-character Residents grid,
a direct resident profile at `/worlds/mbti-house/residents/<characterId>`, the
profile Activity Timeline with a canonical post link, and Back returning to
the Residents grid. Cursor continuation is covered by the infinite-query
test; the seeded profile used for the browser smoke flow had no second page.

#### Known Risks and Follow-Up Work

- Issue #50 remains In Progress until its review pull request is reviewed and
  merged; Plan 09 remains In Progress while sibling tickets are pending.
- The shared `postId` addition is required for comment click-through and is
  covered by API mapper/controller/e2e fixtures; downstream consumers should
  continue parsing the shared contract.
- Public author `id` remains the WorldMember identifier for compatibility and
  OP comparisons; AI authors additionally expose `characterId`, while HUMAN
  authors omit it because they are not Character profiles.
- The public Residents grid and profile are intentionally Character-backed in
  this observer phase. User-backed HUMAN WorldMembers remain valid membership
  and content identities, but their User profile/card and authenticated
  participation UI are deferred to the future human participation phase.
- The repository's existing full API typecheck still reports unrelated search
  fixture errors and implicit-any errors in the e2e spec; the affected API
  activity tests and the running API compile cleanly.

### 09-5 Search, About, Observer Mode, and mobile navigation

Status: In Progress (implementation complete; review and merge pending)

#### Senior-Level Summary

The public observer now has a World-scoped discussion search in the application
header. Search input is validated at two characters, results are parsed through
the shared contract, and both post and comment matches link to the canonical
post detail route. Search comments now carry their parent `postId`, preserving
the API's read-model boundary while giving the dropdown an unambiguous target.
The About World experience is available at `/worlds/$slug/about` and presents
World lore, topic scope, rules, dates, and explicit read-only observation rules.
World navigation uses canonical routes for Feed, Residents, and About, while
the mobile bottom navigation follows the prototype's icon-over-label layout.
Observer Mode remains read-only across feed votes, post votes, replies, and the
comment composer, with shared accessible descriptions and feedback.

#### Files Changed

- `apps/web/src/features/search/` — search gateway, shared-response parsing,
  TanStack Query hook/cache keys, and accessible dropdown states
- `apps/web/src/providers/gateways-provider.tsx` — application search adapter
  composition
- `apps/web/src/routes/__root.tsx`, `apps/web/src/shared/layout/` — current
  World search placement and public Observer Mode header badge
- `apps/web/src/routes/worlds/$slug_.about.tsx` and
  `apps/web/src/features/worlds/components/world-about.tsx` — canonical About
  route and reusable lore/rules presentation
- `apps/web/src/features/worlds/components/world-layout.tsx` and route files —
  route-based navigation and prototype-aligned mobile bottom nav
- `apps/api/src/search/`, `apps/api/test/search.e2e-spec.ts`, and
  `packages/shared/src/schemas/search-response.schema.ts` — search comment
  parent-post contract and OpenAPI/mapper/e2e coverage
- Focused web search/About tests and gateway/query fixtures

#### Architecture and SOLID Notes

The change preserves route/composition root → feature query → feature gateway →
HTTP direction. Search owns its endpoint, adapter, query cache, and dropdown;
the root only supplies the current World slug to the header slot. The API
remains responsible for World scoping and result identity, while the shared
search contract carries the minimum parent-post reference needed for client
navigation. About is a presentational feature component reused by the inline
world snapshot and canonical route. Navigation mode is explicit so complete
standalone Residents/About pages use routes, while the existing world snapshot
can still deep-link its sections.

#### Tests Run

- Web focused search/gateway/query/About suites — passed
- Web full serial suite — 35 files, 151 tests passed
- Web typecheck, lint, format check, production build, and `git diff --check` —
  passed
- API search unit suites — 4 suites, 21 tests passed
- API full e2e suite against PostgreSQL — 12 suites, 123 tests passed

#### Browser Verification

Using the running public app at `http://localhost:5176`, `agent-browser`
verified the World feed, the `microwave` search dropdown result, navigation to
the matching post, disabled vote/reply/comment controls with Observer Mode
feedback, `/worlds/mbti-house/about`, and the 390×844 mobile bottom nav on
both the About and post-detail routes. Screenshots were saved to
`/tmp/aiworld-issue-51-about-mobile.png` and
`/tmp/aiworld-issue-51-post-mobile.png`.

#### Known Risks and Follow-Up Work

- Issue #51 still requires review and merge of its pull request before its
  project item can move to Done; Plan 09 remains In Progress while sibling
  tickets and this review handoff are pending.
- Search comment responses now include `postId`; downstream consumers should
  continue parsing the shared contract rather than reconstructing parent links.

### 09-6 Observer feed visual polish and runtime hygiene

Status: In Progress (implementation complete; review and merge pending)

#### Senior-Level Summary

The observer World screen now uses the prototype's fuller responsive frame:
the shell expands across the available viewport width, the feed starts with a compact
world identity, status, and Hot/New controls, and cards keep author metadata
readable by using relative timestamps and responsive handle visibility. The
desktop summary card is composed only from public World fields and retains
explicit Observer-only access language without simulation-clock telemetry. A
real SVG favicon removes the clean-load 404. Root development now uses
Turborepo's persistent task graph: the web task runs with the API task, then
waits for the API OpenAPI endpoint before starting Vite. Vite's strict port
mode keeps conflicts visible instead of silently moving the web server.
The public worlds landing now follows the prototype's centered hero and card
rhythm, with a capped shell on large screens and safe mobile gutters. The
AIWorld mark is the single worlds-directory entry point; the redundant Worlds
header link is gone.
The follow-up visual audit moved the directory search into the centered header
slot, matched the prototype's glass header gradient, and aligned the mesh and
ambient blob gradients to the prototype's 15%/50% and 85%/30% anchors.
The latest browser audit also corrected the global discussion-search overlay:
its result surface now uses the prototype's compact dropdown geometry with an
opaque dark glass backing, so results cannot visually merge with the page
behind it. The worlds directory no longer renders a redundant total-count
label when there is no pagination to explain.
The observer feedback audit found that repeated upvote/downvote clicks were
appending identical notices to the shared toast queue, unlike the prototype's
single reusable toast element. The toast host now deduplicates identical
notifications and resets their dismissal timer when they are triggered again.

#### Files Changed

- `apps/web/src/features/posts/components/world-feed.tsx` — compact feed
  hierarchy, responsive post cards, and relative timestamps
- `apps/web/src/features/worlds/components/world-list.tsx` and
  `apps/web/src/features/worlds/components/world-card.tsx` — centered landing
  geometry and prototype-aligned world card hierarchy
- `apps/web/src/features/worlds/components/world-directory-search.tsx` and
  `apps/web/src/routes/__root.tsx` — canonical directory search in the header
- `apps/web/src/features/worlds/components/world-detail.tsx` and
  `apps/web/src/features/worlds/components/world-layout.tsx` — feed composition,
  wider three-column shell, responsive mobile navigation, and public summary;
  removed the obsolete inline Residents placeholder and kept Residents route-only
- `apps/web/src/features/search/components/discussion-search.tsx` — compact,
  opaque search-results overlay matching the prototype's dropdown behavior
- `apps/web/src/shared/feedback/toaster.tsx` — reuse and timer reset for
  identical observer notifications
- `apps/web/src/routes/worlds/$slug.tsx` and the Residents route files — canonical
  route-only section state and typed navigation back to the feed
- `apps/web/src/shared/layout/app-shell.tsx`, `app-header.tsx`, and `footer.tsx` —
  full-width shell, mobile-safe stacking, and responsive header/footer sizing
- `apps/web/src/styles/globals.css` — prototype-matched header, mesh, and blob
  gradients
- `apps/web/index.html` and `apps/web/public/favicon.svg` — valid favicon
- `apps/web/src/routes/worlds/-$slug.spec.tsx`, plus scoped post/About route
  and Residents route assertions — feed, summary, and navigation regression
  coverage
- `apps/web/src/routes/worlds/-index.spec.tsx` — public world card hierarchy
  regression coverage, including the no-count single-world state
- `apps/web/src/features/search/components/discussion-search.spec.tsx` — search
  result overlay surface regression coverage
- `apps/web/src/shared/feedback/toaster.spec.tsx` — repeated identical notice
  regression coverage
- `apps/web/src/test/router-harness.tsx` — route-test shell coverage for the
  header-owned directory search
- `AGENTS.md` — idiomatic architecture and in-app browser verification rules
- `package.json`, `turbo.json`, `apps/web/turbo.json`, and
  `apps/web/package.json` — Turborepo runtime dependency and HTTP readiness
  startup
- `apps/web/vite.config.ts`, `pnpm-lock.yaml`, and development README files —
  strict port behavior and documented local startup
- `scripts/dev.mjs` — removed in favor of package/task-level orchestration

#### Architecture and SOLID Notes

The route → TanStack Query → feature gateway → HTTP direction is unchanged.
The World route still owns navigation and URL sort state, Posts owns feed
presentation and query behavior, and the layout remains presentation-only.
The startup change keeps process composition in Turborepo and readiness at the
web/API boundary; it does not alter API contracts or parse process logs. Public
summary content uses the existing World response and does not introduce
telemetry or schema mirrors.

#### Tests Run

- Web focused observer route/post/About suite — 13 tests passed
- Web focused World/Residents route regression suite — 3 files, 13 tests passed,
  including comments navigation, canonical Residents routing, and legacy URL
  normalization
- Web full serial suite (`vitest run --no-file-parallelism`) — 35 files, 153
  tests passed
- Current follow-up web route run — 35 files, 154 tests passed
- Current search/world cleanup run — 35 files, 155 tests passed
- Current observer-notice regression run — 35 files, 156 tests passed
- The API portion of the default `pnpm test` run passed (67 suites, 503 tests);
  its concurrent web-file run hit unrelated local timeout contention, while the
  serial web rerun above passed completely
- Root `pnpm build` — passed
- Web typecheck, lint, and format check — passed
- Root format check and lint — passed
- API Prisma generation, migration status, and seeded MBTI House verification
  — passed
- `pnpm exec turbo run dev --dry` — API/web tasks resolved as persistent, with
  web `with: ["@aiworld/api#dev"]`
- Clean `pnpm dev` smoke — Vite started only after `GET /api/docs` became
  available, with no proxy `ECONNREFUSED` output
- Strict-port conflict smoke — a second Vite startup failed immediately
  instead of moving to another port
- `git diff --check` — passed

#### Browser Verification

Against seeded `http://localhost:5173/worlds/mbti-house?sort=hot`,
`agent-browser` verified the desktop 1280×577 and mobile 390×844 layouts.
Desktop feed geometry measured about 585px wide with the first card at y=168;
mobile cards used 16px gutters with the first card at y=210 and the fixed
mobile nav beginning at y=768. An additional 1024px check collapsed the
summary aside and measured a 701px feed with no horizontal overflow, keeping
the intermediate desktop layout readable. Screenshots were saved to
`/tmp/aiworld-issue-124-desktop.png` and
`/tmp/aiworld-issue-124-mobile.png`. The public flow also verified post
comments, Observer Mode feedback, Back navigation, Residents, a resident
profile, its Activity Timeline, and the favicon request (200). Browser
console and page-error output were empty. The in-app browser regression pass
also checked 390×844 at the bottom of the Residents page (mobile About
navigation remained clickable), 1024×768 (no duplicate Residents placeholder),
and 1946×1212 (full-width shell and a real post-detail comments link). A
2560×1440 check measured a 2496px layout with a 1232px feed and verified the
canonical Residents route from the world navigation.

The in-app browser then rechecked the running app at 1280×720, 1920×1080,
and 390×844. At 1920px the header and main shell were capped at 1280px and
centered; at 390px the worlds landing and feed had 16px gutters, no horizontal
overflow, and the fixed mobile navigation remained usable. The worlds header
contained only the AIWorld worlds link and Sign in, and the feed sort control
spanned the feed column.

The direct app/prototype comparison also measured the header search at 448px
wide on desktop and 38px high, with the app's header and mesh background using
the same gradient declarations and the first world card starting at y=313px
versus the prototype's approximately y=308px at the same viewport.

The follow-up in-app browser comparison opened the prototype feed state and
confirmed its sidebar uses indigo, emerald, and amber icon colors, while its
feed contains no embedded About content. The app now matches those nav colors;
the feed has no About section, `/worlds/:slug/about` is the sole About page,
and legacy `?section=about-world` state redirects there. The corrected app was
rechecked at 1280×720: the feed DOM contains no About heading, the About route
contains no feed region, and the sidebar icon classes match the prototype.

The latest in-app browser reproduction typed `sas` into the Residents page
search. The result panel measured 114px high with the compact `max-h-64`
geometry and an opaque `bg-surface/95` backing; resident cards no longer show
through the result text. The worlds landing page was also checked after the
single-world cleanup: there is no world-count output and no pagination region
when the API reports one world.

The observer notice reproduction then triggered the first feed Upvote control
three times with the in-app browser. Before the fix, the Notifications region
contained three identical notices; after the fix, it contained one notice with
the same prototype-style repeated-trigger behavior.

#### Known Risks and Follow-Up Work

- Direct `pnpm --filter @aiworld/web dev` now expects the API to be available;
  the root `pnpm dev` command is the normal full-stack entry point.
- A readiness probe confirms that an API endpoint responds; it cannot identify
  whether that listener belongs to the current Turbo invocation. Vite's strict
  port setting still exposes duplicate web-server attempts clearly.
- Plan 09 remains In Progress until this ticket and the sibling review
  handoffs are reviewed and merged.
