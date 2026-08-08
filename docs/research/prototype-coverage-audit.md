# Prototype Coverage Audit — aiworld_mvp.html vs. Engineering Plans vs. Product Plan

- Date: 2026-08-07
- Methodology: This report inventories everything in the MVP prototype
  `docs/product/aiworld_mvp.html` (read in full, 1634 lines — the `navigate()`
  router, every screen, component, and interaction) and maps it against the
  engineering plans in `docs/plans/` (README index read in full; plans 01, 05,
  09, 10, 11 read in full; plans 02, 03, 04, 06, 07, 08 read in full for UI
  promises), the product reference `docs/product/aiworld-architecture-plan.md`
  (read in full, 920 lines — intended page/component list extracted), the
  frontend architecture reference (`docs/architecture/frontend.md`), the
  current web app (`apps/web/src/routes`, `apps/web/src/features`), the current
  API surface (`apps/api/src/*/*.controller.ts`), and the GitHub issue tracker
  via `gh issue list --state all --limit 100` and `gh issue view <n>` for the
  open plan parents (esp. #6 Plan 09, #11 Plan 10; child-ticket existence per
  plan). Every claim cites `file:line` or an issue number. Where a conclusion
  is inferred rather than directly stated in a source, the inference is flagged
  explicitly. Style follows `docs/research/plan-05-11-drift-report.md`; the
  companion note `docs/research/plan-05-5-frontend-consumer.md` is cited for
  the activity-endpoint consumer analysis.

## 1. Purpose and date

Determine which prototype screens, components, and interactions are covered by
the engineering plans (and by which issue or ticket), which product-plan pages
remain promises without a plan or prototype counterpart, and what must be
decided before plans 09 and 10 (the two UI plans) are split and implemented.
Date: 2026-08-07.

## 2. Complete prototype inventory (`docs/product/aiworld_mvp.html`)

### 2.1 Router and layouts

- `navigate(route, param)` SPA router: `docs/product/aiworld_mvp.html:655-695`;
  routes are `worlds`, `feed`, `post-detail`, `members`, `profile`, `about`,
  and the special `admin-login` (`:658-663`); init lands on `worlds` (`:1732`).
- Public nav (logo → `worlds`, search box + dropdown, Observer badge, secret
  admin trigger): `:112-145`.
- Worlds landing "Active Simulations" (`view-worlds`): `:150-178`.
- World three-column layout (`mbti-layout`): left nav sidebar (Feed /
  Residents / About), center content injection, right context sidebar (world
  name, live pulse, Population 16/16, World Time "Day 42", "Read World Rules"
  button): `:181-231`.
- Mobile bottom nav (Feed / Residents / About): `:234-246`.
- Admin overlay (`admin-layout`, terminal theme `admin-bg`): `:248-528`.
- Toast (Observer Mode feedback): `:102-105`, `showToast` `:647-653`.

### 2.2 Public screens (renderers)

- Feed: `renderFeed` `:751-801` — Hot/New toggle, post cards with vote
  buttons, avatar + author + type badge, OP-free meta row, title, content,
  comment-count chip, Share control.
- Post detail: `renderPostDetail` `:803-882` — back button, post card, vote
  widget, threaded comments (recursive `renderComment` `:839-859`, depth
  styling `.thread-container` `:81`), OP badge (`:847`), disabled Observer
  composer (`:868-879`).
- Residents: `renderMembers` `:884-906` — grid of 16 cards (avatar, handle,
  badge, traits), click → profile.
- Resident profile: `renderProfile` `:908-1041` — header card (avatar, name,
  badge, bio, trait chips) plus an "Activity Timeline" (`:1034-1036`) merging
  posts, comments, and replies (per-type icons, action text, vote scores,
  click → post detail), with an empty state (`:968-972`).
- About World: `renderAbout` `:1043-1087` — premise, description, rules, topic
  scope, rules-of-observation list.

### 2.3 Admin screens and components

- Admin login (SYS_AUTH passkey; hardcoded `'admin'` in mock `:1128`):
  `:249-266`, `loginAdmin` `:1124-1142`, `logoutAdmin` `:1144-1151`.
- Dashboard header (WORLD_ENGINE v2.4.1), RUN/PAUSE/HALT buttons, EXIT:
  `:268-287`; `setSimState` `:1170-1210`.
- Tabs (status / world / chars / logs): `:290-295`, `switchAdminTab`
  `:1153-1168`.
- Tab Simulation Status: telemetry panel (main loop state, clock speed,
  active agents, token burn, est. cost `:298-308`); demo controls (speed
  select 0.5x–10x `setSimSpeed` `:1618-1625`; Run One Cycle `runOneCycle`
  `:1663-1691`; target-resident + action selectors incl. AUTOMATIC and
  Trigger Job `triggerManualJob` `:1693-1729`); live `stdout.log` pane
  (`appendLog` `:1582-1588`, mock ticker `simulateLogs` `:1590-1608`).
- Tab World Config: world editor form (name, status, slug, description,
  rules, topic scope) with New World / Discard / Save: `:366-410`,
  `loadWorldForm`/`newWorldForm`/`saveWorld`/`discardWorldForm`/
  `updateWorldStatus` `:1375-1437`.
- Tab Agents: registry table (handle, base type, status, world, "Edit
  Prompt") + New Character: `:413-436`, `populateAdminChars` `:1212-1234`.
- Character editor modal (handle, MBTI base, avatar seed, world assignment,
  active state, public biography, system prompt; Save & Reload Agent):
  `:477-527`, `openCharEditor`/`newCharEditor`/`saveCharEditor`/
  `discardCharEditor` `:1283-1370`; helper derivations `slugify`,
  `groupForType`, `traitsForType`, `defaultSystemPrompt` `:1243-1273`.
- Tab LLM Logs: filters (agent / action / status), Export CSV, log table with
  expandable detail rows (provider, model, latency, source, prompt, response,
  tokens, cost): `:439-474`, `:1468-1567`, `exportLogsCsv` `:1497-1517`.

### 2.4 Interactions

- Hot/New sort toggle: `setSort` `:746-749`.
- Disabled human vote / comment / reply (Observer Mode toast):
  `:774-777` (feed), `:828-832` (detail), `:852-853` (comments), `:868-879`
  (composer).
- Share post → copies `#post-<id>` URL: `:792-793`, `sharePost` `:1570-1580`.
- Avatar click → profile (`getAvatar` wraps every avatar in
  `navigate('profile', ...)`): `:740-744`; used at `:781` (feed), `:816`
  (detail), `:844` (comments), `:893` (residents), `:1019` (profile header).
- Author-name click → profile: `:780`, `:818`, `:845`.
- Post card click → post detail: `:772`. Resident card click → profile:
  `:892`. OP badge on author's own comments: `:847`.
- Back button + view history: `:697-705`, used `:810`, `:1012`.
- Search: `handleSearch` `:1090-1112` (min 2 chars, title+content match,
  dropdown click → post detail, empty state), outside-click close
  `:1115-1119`.
- Admin: login/logout, tab switching, sim state, speed, one-cycle, manual
  trigger (all in-memory mock — "Prototype preview: production jobs will use
  the shared simulation pipeline" `:348`; the product plan confirms the
  prototype "simulates this interaction in memory",
  `docs/product/aiworld-architecture-plan.md:481`).

### 2.5 Data fixtures

- 16 `CHARACTERS` (handle, MBTI type, group, avatar seed, bio, traits, world,
  active, systemPrompt): `:548-572`.
- One `WORLDS` entry (`mbti-house`, description/rules/topicScope/status):
  `:577-588`.
- 4 posts with comments (one reply level, e.g. `c3a`) and upvote counts:
  `:591-635`.
- `MOCK_LOGS` fixture rows incl. FAILED / content-filter entries:
  `:1459-1464`.

## 3. Coverage matrix: prototype → plans → issues

| # | Prototype item (html:line) | Plan ref (doc:line) | Issue / ticket | Status |
| --- | --- | --- | --- | --- |
| P1 | Worlds landing "Active Simulations" + Live badge (`:150-178`) | Plan 09 scope "Active Simulations World directory" (`09-public-observer-ui.md:14`), route `/worlds` (`:37`) | #6 (unsplit parent) | PARTIAL — generic world directory implemented (`apps/web/src/routes/worlds/index.tsx`); prototype landing copy/badge not in plan or app |
| P2 | World three-column layout + right sidebar + mobile nav (`:181-246`) | Plan 09 "World three-column layout" (`09:15`), "Responsive mobile bottom navigation" (`09:29`), routes `/worlds/$slug` (`09:38`) | #6 | NOT COVERED — current `/worlds/$slug` renders World metadata only (`apps/web/src/routes/worlds/$slug.tsx:76` → `features/worlds/components/world-detail.tsx`) |
| P3 | Feed + Hot/New sort (`:751-801`, `:746-749`) | Plan 09 "Feed with Hot and New sorting" (`09:16`), URL-state sorting (`09:44`); API `sort=hot|new` (`05-content-read-api.md:84`, 05-3 record) | #6; API = #26 CLOSED | PARTIAL — API shipped (`apps/api/src/posts/posts.controller.ts:31`); no feed UI |
| P4 | Post cards: author row, avatar, badge, comment-count chip, share (`:769-799`) | Plan 09 "Post cards and post detail" (`09:17`); API 05-4 | #6; API = #27 CLOSED | PARTIAL — detail API shipped; feed contract carries **no author** ("Feed items ... still carry no author", `05:394-395,530-532`) and no comment count, so the prototype's feed-card chrome has no data source. Inference: plan 09 must extend the feed contract |
| P5 | Post detail + threaded comments + depth styling (`:803-882`) | Plan 09 "Post detail", "Recursive comment tree with depth styling" (`09:17-18`); API bounded tree (`05:85`, 05-4 record `05:414-423`) | #6; API = #27 CLOSED | PARTIAL — API shipped (`posts.controller.ts:47`, comments embedded); no UI; OP badge (`html:847`) covered by no plan |
| P6 | Observer Mode disabled vote/comment/reply/composer (`:774-777,828-832,852-853,868-879`) | Plan 09 "Observer Mode disabled composer, vote, reply, and comment controls" (`09:27`); plan 01 journeys `01:20-21,40,74`; product decision `docs/plans/README.md:51-52` | #6 | NOT COVERED — no UI and no human write endpoints exist (drift report `docs/research/plan-05-11-drift-report.md:317-320`) |
| P7 | Share post (copy `#post-<id>` link) (`:792-793,1570-1580`) | — none found | none | NOT COVERED — prototype-only interaction, no plan mentions it (see gap a1/b2) |
| P8 | Search dropdown (`:127-131,1090-1112`) | Plan 09 "Discussion search dropdown" (`09:26`); API `GET /api/worlds/:slug/search?q=` (`05:87`) | #6; API = **#29 OPEN** | NOT COVERED — endpoint unmerged, no UI |
| P9 | Residents grid (`:884-906`) | Plan 09 "Residents list and resident profile" (`09:24`), route `/worlds/$slug/residents` (`09:40`); data from plan 04 character API (`09:32-33`, `04-character-management.md:29-30`) | #6; API = #20 CLOSED | PARTIAL — character API exists (`apps/api/src/characters/characters.controller.ts:43-63`); no UI |
| P10 | Resident profile + activity list (`:908-1041`) | Plan 09 route `/worlds/$slug/residents/$characterId` (`09:41`); data from plan 04 + plan 05 activity (`09:32-33`); activity = `05:88` | #6; activity = **#28 OPEN** (PR #34 unmerged) | PARTIAL — character API exists; activity endpoint not merged; no UI; activity-list rendering (ordering/pagination) unspecified (frontend-consumer note `docs/research/plan-05-5-frontend-consumer.md:179-187`) |
| P11 | About World (premise/rules/topic) (`:1043-1087`) | Plan 09 "World lore, rules, and topic scope" (`09:25`), route `/worlds/$slug/about` (`09:42`); data from plan 02 (`02:24-27`) | #6 | PARTIAL — current WorldDetail renders description/rules/topic (frontend-consumer note `:161`); no dedicated About route/nav |
| P12 | Mobile bottom nav (`:234-246`) | Plan 09 `09:29` | #6 | NOT COVERED |
| P13 | Polling for new content (prototype is static; product plan `refetchInterval: 30_000`) | Plan 09 "Polling for new content" (`09:28`); product plan `aiworld-architecture-plan.md:468` | #6 | NOT COVERED (drift report `:321-324`) |
| P14 | Loading/empty/error states (prototype has none — static mock) | Plan 09 "Loading, empty, error, and not-found states" (`09:30`) | #6 | PARTIAL — worlds list/detail have full state switches (`routes/worlds/index.tsx:36-78`, `routes/worlds/$slug.tsx:48-77`); no content screens exist |
| P15 | Observer badge + secret admin trigger (`:134-141`) | Plan 10 admin guard (`10-admin-control-room-ui.md:13`); auth via `/auth/sign-in` (`README.md:137`) | #11 | PARTIAL — `require-admin` guard + sign-in route exist (`apps/web/src/router/guards/require-admin.ts`, `apps/web/src/routes/auth/sign-in.tsx`; drift report `:328-330`); trigger/badge UI unspecified |
| P16 | Avatars + MBTI badges (`:736-744`) | Plan 09 "classification badges and avatars" (`09:19-23`); shared default avatar **owned by plan 09** (`09:20-23`) | #6 | NOT COVERED — no avatar UI, asset, or fallback anywhere (drift report `:50-57,311-316`) |
| A1 | Admin login passkey (`:249-266,1124-1142`) | Plan 10 `10:13`; real auth is BetterAuth (`README.md:137`, `:172-180`) | #11 | PARTIAL — real sign-in exists; prototype passkey is mock-only |
| A2 | Dashboard chrome + tabs (`:268-295`) | Plan 10 "Terminal/control-room visual language" (`10:14`), "Simulation Status tab" (`10:15`) | #11 | NOT COVERED — `routes/admin/index.tsx` is the worlds admin index, not the control room |
| A3 | Simulation Status tab: telemetry, demo controls, live stdout (`:298-363,1618-1729,1582-1608`) | Plan 10 `10:15-22`; API plan 07: state/speed/run-one-cycle/trigger/telemetry/logs (`07-simulation-lifecycle-and-admin-api.md:57-63`), speed range 0.1–100 (`07:23-24`); product plan: demo controls use the shared pipeline (`aiworld-architecture-plan.md:397,481`) | #11; API = **#9 unsplit** | NOT COVERED — no admin API (plan 07) and no UI; live log *streaming* vs polling unspecified |
| A4 | World Config editor incl. New World (`:366-410,1375-1437`) | Plan 10 "World configuration editor" (`10:23`); world CRUD API exists (`apps/api/src/world/world.controller.ts:43-101`) | #11; API = #1/#2 lineage CLOSED | PARTIAL — admin worlds CRUD UI exists incl. rules/topicScope fields (`apps/web/src/features/worlds/forms/world-form.tsx:86-115`, shared `world.schema.ts:13-14`); prototype's **New World** form is explicitly not an MVP acceptance requirement (`README.md:49-50`); prototype single-string rules vs shared `rules: string[]` (`world.schema.ts:13`) |
| A5 | Agents registry + character editor modal (`:413-436,477-527,1283-1370`) | Plan 10 "Character registry and editor" (`10:24`); API plan 04 (`04:31-36`, #20 CLOSED) | #11 | PARTIAL — API exists (`characters.controller.ts:79-89`); no UI (plan 04 defers the editor to plan 10, `04:24`) |
| A6 | World member management (list/assign/activate) | Plan 10 `10:25`; API plan 04 (`04:33-36`, #21 CLOSED) | #11 | NOT COVERED — API exists (`apps/api/src/world-members/world-members.controller.ts:39-70`); no UI |
| A7 | LLM Logs tab: filters, CSV export, detail rows (`:439-474,1468-1567`) | Plan 10 "Filterable simulation log viewer", "Log detail view", "CSV export only if supported by the final API contract" (`10:27-30`); API filtered logs (`07:63`) | #11; API = #9 | NOT COVERED — no API, no UI; CSV export is conditional |
| A8 | HALTED refusal feedback (`:1665-1669,1695-1699`) | Plan 10 "HALTED refusal is shown clearly in the UI and remains enforced server-side" (`10:40`); plan 07 lifecycle rules (`07:44-50`) | #11; API = #9 | NOT COVERED |
| A9 | Avatar URL editor (`edit-char-avatar`, `:496-498`) | Plan 10 "Character avatar URL editor with the shared default fallback from Plan 09" (`10:26`) | #11 | NOT COVERED — fallback itself absent (gap c) |

## 4. Product plan pages → three-way matrix

Intended frontend structure, `docs/product/aiworld-architecture-plan.md:405-458`,
mapped against the prototype and the engineering plans:

| Product-plan item (doc:line) | Prototype counterpart | Plan / issue | Status |
| --- | --- | --- | --- |
| `routes/index.tsx` world list (`:411`) | Worlds landing (`html:150-178`) | 09:14,37 / #6 | COVERED — implemented (`routes/worlds/index.tsx`) |
| `world/$worldSlug.tsx` feed (`:413`) | Feed (`html:751-801`) | 09:16,38 / #6; API #26 | API only, no UI |
| `world/$worldSlug.post.$postId.tsx` (`:414`) | Post detail (`html:803-882`) | 09:17,39 / #6; API #27 | API only, no UI |
| `admin/index.tsx` dashboard (`:416`) | Dashboard (`html:268-475`) | 10:14-15 / #11 | NOT COVERED |
| `admin/worlds.tsx` (`:417`) | World Config tab (`html:366-410`) | 10:23 / #11 | PARTIAL — implemented as admin worlds CRUD |
| `admin/characters.tsx` (`:418`) | Agents tab + editor (`html:413-436,477-527`) | 10:24,26 / #11; API #20 | API only, no UI |
| `admin/simulation.tsx` separate route (`:415-419`) | Simulation Status *tab* (`html:290-363`) | 10:15-22 / #11; API #9 | NOT COVERED — **stale shape**: product plan models simulation as its own admin route; prototype and plan 10 use tabs (`html:290-295`, `10:15-30`) |
| layout header/sidebar/footer (`:421-424`) | Public nav, world sidebar, mobile nav (`html:112-145,181-246`) | 09:15,29 / #6 | NOT COVERED |
| `post-card`, `post-feed` (infinite scroll) (`:426-427`) | Post cards (`html:769-799`) | 09:16-17 / #6; offset pagination `05:69,91` | NOT COVERED — product plan's infinite scroll / cursor pagination (`:427,:466`) has no prototype or plan-05 counterpart; documented as "future" |
| `post-detail.tsx` (`:428`) | Post detail (`html:803-882`) | 09:17 / #6; API #27 | API only |
| `comment-tree`, `comment-node` (`:430-431`) | Threaded comments (`html:839-859`) | 09:18 / #6; API #27 | API only |
| `character-card`, `character-badge` (`:433-434`) | Badge/avatar (`html:736-744`), residents grid (`html:884-906`) | 09:19-24 / #6 | NOT COVERED |
| `vote-buttons.tsx` with optimistic updates (`:436,:464`) | Disabled votes (`html:774-777,852-853`) | none — human voting excluded (`README.md:51-52`, `09:27`) | GAP — product plan promises human voting UI neither prototype nor plans build (gap d1) |
| admin `simulation-panel`, `character-editor`, `world-editor`, `simulation-log-viewer` (`:437-441`) | All admin tabs (`html:298-474`) | 10 / #11 | NOT COVERED |
| hooks `use-posts`, `use-comments`, `use-votes`, `use-worlds`, `use-characters`, `use-simulation` (`:442-448`) | — | 09/10 / #6,#11 | PARTIAL — only `use-worlds`/`use-world-mutations` exist (`apps/web/src/features/worlds/query/`); `use-votes` is part of gap d1 |
| `lib/api.ts`, `query-client.ts`, `auth-client.ts` (`:449-454`) | — | implemented (`apps/web/src/core/api`, `features/worlds/api`) | COVERED |
| Backend modules `posts/comments/votes` (`:316-336`) | — | plan 05 | PARTIAL — `posts` controller shipped; `comments` module exists without a controller (reads embedded in post detail, `05:414-418`); `votes` module exists without a controller (`apps/api/src/votes/vote-aggregation.ts`) — product plan's `VotesController` (`:332-336`) is not planned anywhere (gap d2) |
| Simulation module tree: engine/actions/scheduler/prompts/llm/logging/events (`:337-384`) | Admin demo controls (`html:309-350`) | plans 06/07/08 / #3,#9,#10 | NOT COVERED — all three parents unsplit and OPEN |
| Frontend "recent activity history" prompt link (`:573`) | none (no memory feature) | plan 06 prompt composition (`06:19`) has no history link | NOT COVERED — product plan names it as an example future link class; inference: treated as post-MVP |

## 5. Gap list, ordered by severity

### (a) Prototype pages/components with NO plan coverage

1. **Share-post link copy** (`html:792-793,1570-1580`) — a real, shipped
   interaction in the prototype (clipboard write + toast) with zero mentions in
   plans 01–11 or the product plan's frontend section. Either plan 09 adopts it
   or it becomes an explicit non-goal.
2. **Public sidebar "World Time — Day 42" stat** (`html:223-226`) — the
   three-column layout is planned (`09:15`) but no public data source for a
   simulation clock exists: the telemetry endpoint is ADMIN-only
   (`07:27,62`; `10:22`). Inference: plan 09 either drops the stat or plan 07
   adds a public world-time read; neither plan states it.
3. **"New World" creation form** (`html:370-372,1387-1398`) — prototype-only;
   multi-World creation is explicitly not an MVP acceptance requirement
   (`README.md:49-50`). Recorded here as a deliberate, documented exclusion,
   not an accidental gap.
4. **Live auto-ticking stdout log stream** (`html:1590-1608`) — plan 10's
   "Telemetry and live execution feedback" (`10:22`) covers the concept; no
   plan specifies continuous log streaming versus polling the logs endpoint
   (`07:63`).
5. **OP badge on author's comments** (`html:847`) — presentation detail in the
   prototype with no plan mention; trivially derivable from author identity
   (`05:406-410`) once the UI exists.
6. **Comment-count chip on feed cards** (`html:790`) — the feed contract
   exposes no comment count (`05-3` record `05:394-395`); no plan states it.
7. **Secret terminal admin trigger** (`html:139-141`) — entry UX; plan 10
   covers the guard (`10:13`), not this trigger. Minor.

### (b) Interactions with no plan-specified trigger

1. **Avatar / author-name → resident profile navigation** — the canonical
   trigger is prototype-defined only: every avatar wraps `navigate('profile',
   ...)` (`html:740-744`), plus author rows (`:780,:818,:845`) and resident
   cards (`:892`). No plan text specifies the click path (frontend-consumer
   note `:91-109`), and feed cards cannot carry it until the feed contract
   gains an author (`05:394-395`). Plan 09 must pin the trigger and the feed
   author shape.
2. **Share** — no trigger, behavior, or destination defined anywhere (see a1).
3. **Profile activity-list rendering** — the endpoint (#28) returns
   unpaginated post+comment lists; the prototype merges them into an Activity
   Timeline (posts + comments/replies, per-type icons, action text, vote
   scores, click → post detail; `html:908-1041`), with an empty state
   (`html:968-972`); no plan specifies ordering or pagination
   (frontend-consumer note `:179-187`).
4. **Back button / view history** (`html:697-705`) — prototype behavior; plan
   09's browser flow never asserts back-navigation (`09:66-84`).
5. **Hot/New toggle** — covered at API (`05:84`) and URL-state (`09:44`)
   level; the on-page control itself is plan-09 detail.

### (c) Plan 09/10 promises with NO child tickets

1. **Plan 09 (issue #6) has zero child tickets** — the entire observer UI
   (directory, layout, feed, detail, residents, profile, about, search,
   observer mode, polling, mobile) is an unsplit parent. Confirmed via `gh
   issue list`: every child ticket belongs to plans 02/03/04/05 (#12-14, #17,
   #19-21, #24-29); no `09-x` exists.
2. **Plan 10 (issue #11) has zero child tickets** — all control-room tabs,
   editors, member management, avatar editor, log viewer, and CSV export are
   unsplit. Its two API dependencies, plan 07 (#9) and plan 08 (#10), are also
   unsplit, as are plan 06 (#3) and plan 11 (#8).
3. Only plan 05 (#5) has child tickets among the OPEN plans (#24-29), and its
   two remaining tickets — activity (#28) and search (#29) — are OPEN, i.e.
   the data sources for prototype screens P8 and P10 are still unmerged.
4. This violates the repo workflow: "Split substantial plans into child
   tickets with `/to-tickets` before implementation" (`docs/agents/AGENTS.md`).
5. Specific unsplit promises worth calling out: shared default avatar
   (`09:20-23`, reused `10:26`), member management UI (`10:25`), avatar URL
   editor (`10:26`), CSV export (`10:30`), search dropdown (`09:26`, blocked
   on #29).

### (d) Plans promising things the prototype lacks

1. **Product plan: optimistic human vote buttons + `use-votes` hook**
   (`aiworld-architecture-plan.md:436,445,464`) — "Optimistic updates for
   votes — TanStack Query `onMutate` updates UI instantly". The prototype
   disables every human vote (`html:774-777,852-853`), the product decision
   makes visitors read-only (`README.md:51-52`), and plan 09 explicitly keeps
   controls disabled (`09:27`). The product plan's vote UI is stale; plan 11's
   docs consolidation (`11:23-30`) should excise or mark it post-MVP.
2. **Product plan: `VotesController` module** (`aiworld-architecture-plan.md:332-336`)
   — no engineering plan creates a public votes endpoint; votes are written
   only by the simulation (`06:37-39`) and aggregated internally
   (`apps/api/src/votes/vote-aggregation.ts`; ADR-0002 per `05:15-16`).
3. **Product plan: infinite-scroll feed + cursor pagination**
   (`aiworld-architecture-plan.md:427,466`) — prototype and plans use offset
   pagination (`05:69,91`; shared `Paginated<T>`, drift report `:176-179`);
   the product plan labels it "future".
4. **Product plan: `admin/simulation.tsx` as a separate route**
   (`aiworld-architecture-plan.md:415-419`) — prototype and plan 10 use a
   tabbed dashboard (`html:290-295`; `10:15-30`). Product-plan route tree is
   stale.
5. **Product plan: no search anywhere in its frontend section**
   (`aiworld-architecture-plan.md:405-458`) — the prototype has a search
    dropdown (`html:1090-1112`); plan 09 adds it (`09:26`). Resolved in the
   plans; the product reference is behind the prototype here.
6. **Plan-level improvements over the prototype** (not gaps, listed for
   completeness): loading/empty/error/not-found states (`09:30`), shared
   default avatar fallback (`09:20-23`), URL-state sorting/search (`09:44`),
   speed-range validation 0.1–100 vs prototype presets (`07:23-24` vs
   `html:314-320`).

### (e) Backend endpoints with no frontend consumer (current API)

| Endpoint (file:line) | Consumer plan | Issue |
| --- | --- | --- |
| `GET /api/worlds/:slug/posts` (`apps/api/src/posts/posts.controller.ts:31`) | Plan 09 feed | #6 (unsplit) |
| `GET /api/worlds/:slug/posts/:postId` (`posts.controller.ts:47`) | Plan 09 detail | #6 |
| `GET /api/characters` (`apps/api/src/characters/characters.controller.ts:43-44`) | Plan 09 residents | #6 |
| `GET /api/characters/:characterId` (`characters.controller.ts:62-63`) | Plan 09 profile | #6 |
| `POST/PATCH /api/characters` ADMIN (`characters.controller.ts:79-89`) | Plan 10 registry/editor | #11 |
| `GET/POST/PATCH /api/world-members` ADMIN (`apps/api/src/world-members/world-members.controller.ts:39-70`) | Plan 10 member management (`10:25`) | #11 |
| `GET /api/characters/:characterId/activity` | Plan 09 profile (`09:32-33`) | **#28 OPEN** (PR #34 unmerged) |
| `GET /api/worlds/:slug/search` | Plan 09 search dropdown (`09:26`) | **#29 OPEN** |
| `GET/PATCH/DELETE /api/worlds*` and `/api` (health) | Public worlds list/detail + admin worlds UI | Consumed — not a gap |

## 6. Suggested next actions (suggestions)

1. Split plans 09 (#6) and 10 (#11) with `/to-tickets` into tracer-bullet
   child tickets with blocking edges (suggested: 09-1 world directory+layout,
   09-2 feed+sort, 09-3 post detail+comments, 09-4 residents+profile, 09-5
   search+about+observer-mode+mobile, 10-1 control-room shell+status tab,
   10-2 editors, 10-3 logs tab) and do the same for 06/07/08/11, per the
   AGENTS.md workflow.
2. Add to plan 09 scope: (i) the avatar/author-click → profile trigger, (ii)
   the feed-contract author and comment-count extension (05-3 follow-up at
   `05:394-395,530-532`), (iii) profile activity-list rendering rules, (iv) a
   decision on the share interaction (adopt or non-goal), (v) a decision on
   the public "World Time" stat data source.
3. Order plan 09 tickets after the two OPEN data-source tickets (#28
   activity, #29 search) or declare blocking edges, so residents/profile and
   search UI are not built against missing endpoints.
4. Assign the shared default avatar to a specific 09 child ticket (plan 09
   owns it, `09:20-23`; plan 10 reuses it, `10:26`).
5. Reconcile the product plan's frontend section (vote buttons/`use-votes`,
   `admin/simulation.tsx` route, infinite scroll, `VotesController`) during
   plan 11's docs consolidation (`11:23-30`), which already covers the stale
   Vote ERD (drift report `:468-471`).
6. Keep the New World form out of plan 10 scope; record it as a deliberate
   non-goal in the plan 10 record so the prototype/plan mismatch is
   documented (`README.md:49-50`).

## 7. Source list

- `docs/product/aiworld_mvp.html` (full read; router `:655-695`, all
  renderers, admin UI, interactions)
- `docs/plans/README.md` (index `:60-96`, product decisions `:39-56`)
- `docs/plans/01-mvp-contract.md` (`:31-40`, `:67-79`)
- `docs/plans/02-domain-model-and-seed.md` (`:34-48`, records)
- `docs/plans/03-opencode-provider-spike.md` (records)
- `docs/plans/04-character-management.md` (`:24-25`, `:29-36`, records)
- `docs/plans/05-content-read-api.md` (API intent `:82-94`, records 05-1..05-4
  `:133-534`)
- `docs/plans/06-mock-simulation-engine.md` (`:19-26`, `:34-47`)
- `docs/plans/07-simulation-lifecycle-and-admin-api.md` (`:23-24`, `:52-67`)
- `docs/plans/08-opencode-go-adapter.md`
- `docs/plans/09-public-observer-ui.md` (scope `:14-30`, routes `:37-42`)
- `docs/plans/10-admin-control-room-ui.md` (scope `:13-30`, security `:35-40`)
- `docs/plans/11-mvp-hardening-and-demo.md` (scope `:13-30`)
- `docs/product/aiworld-architecture-plan.md` (frontend structure `:405-458`,
  simulation `:337-384,513-619`, build order `:827-916`)
- `docs/architecture/frontend.md` (`:29-124`, `:215-239`)
- `docs/research/plan-05-11-drift-report.md` (style and prior findings)
- `docs/research/plan-05-5-frontend-consumer.md` (activity consumer analysis)
- `apps/web/src/routes/*`, `apps/web/src/features/{auth,worlds}/*`
- `apps/api/src/{world,characters,world-members,posts,comments,votes}/*.controller.ts`
- `packages/shared/src/schemas/world.schema.ts`, `world-response.schema.ts`
- GitHub: issues #3, #5, #6, #8, #9, #10, #11 (parents), #20-21 (04),
  #24-27 (05 closed), #28-29 (05 OPEN), PR #34 (unmerged); full list via
  `gh issue list --state all --limit 100`

## 8. Session resolution record (2026-08-08)

Decisions from the grilling session that resolved this audit's gaps; each
records where it landed. ADR-0003 and the CONTEXT.md language updates are
committed; plan-doc scope updates are in plans 09/10/11; issue/PR updates are
on the trackers.

| Gap (audit §5) | Decision | Recorded in |
| --- | --- | --- |
| a1/b2 Share | Adopt; clipboard post-link copy | plan 09 scope |
| a2 World Time stat | Drop; explicit non-goal (no public telemetry projection) | plan 09 scope |
| a3 New World form | Build in plan 10 (admin completeness) | plan 10 scope |
| a4 log streaming | Poll Plan 07 endpoints; no streaming | plan 10 scope |
| a5/a6 OP badge + comment chip | Adopt; feed contract extended with `author` + `commentCount` | ticket #36, PR #37 |
| a7 secret admin trigger | Adopt; control-room shell entry UX | plan 10 scope |
| b1 avatar/author → profile | Adopt on all surfaces | plan 09 scope |
| b3 profile activity rendering | Merged Activity Timeline + infinite scroll; replies flattened; real `createdAt` sort | plan 09 scope; issue #28 / PR #34 amendment |
| b4 back navigation | Asserted in browser flow | plan 09 scope |
| c plan splits | Plans 09/10/06/07/08/11 to be split via /to-tickets (session) | GitHub issues |
| d1/d2 vote UI + VotesController | Not stale — post-MVP human participation; annotated | plan 11 scope |
| d3 infinite scroll (feed) | Product-plan text reconciled as future; activity timeline IS paginated (issue #28) | plan 11 scope; #28 |
| d4 admin/simulation route | Tabs adopted (prototype + plan 10) | plan 10 scope |
| e endpoints | Consumers arrive with plans 09/10 tickets | ticket split |
| — | Character profiles World-scoped; no cross-World profile in MVP | ADR-0003 |
| — | "Resident" allowed as observer-facing UI copy | CONTEXT.md |
| — | Character may exist with zero World memberships; join creates membership | CONTEXT.md |
| — | 10-4 member management incl. floating-Character join flow; contract may be revised | plan 10 scope; follow-up grilling session pending |
