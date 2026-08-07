# Plan 05-5 Frontend Consumer Report

- Date: 2026-08-07
- Question: How is the frontend design for the character-activity feature
  (`GET /api/characters/:characterId/activity?worldSlug=...`, PR #34 / issue
  #28) tracked in the other plans, and is there a planned trigger path and a
  cross-World profile like Reddit's cross-subreddit user page?
- Methodology: All claims were verified against primary sources in the repo
  and on GitHub. Read in full: `docs/plans/README.md`,
  `docs/plans/01-mvp-contract.md`, `04-character-management.md`,
  `05-content-read-api.md`, `06-mock-simulation-engine.md`,
  `07-simulation-lifecycle-and-admin-api.md`, `09-public-observer-ui.md`,
  `10-admin-control-room-ui.md`, `11-mvp-hardening-and-demo.md`,
  `docs/architecture/frontend.md`, `CONTEXT.md`, both ADRs, and the existing
  research note `docs/research/plan-05-11-drift-report.md` (style reference).
  The product source material (`docs/product/aiworld-architecture-plan.md`
  frontend section, `docs/product/aiworld_mvp.html` navigation and
  `renderProfile`) and the current web app (`apps/web/src/routes`,
  `apps/web/src/features`) were inspected. GitHub primary sources were read
  via the `gh` CLI (issues #5, #6, #28, #29 and the full issue list; PR #34
  body, comments, and full diff). PR #34's code was read directly from the
  branch `origin/plan/05-5-character-activity` (`git show`) because it is not
  merged into the working tree (working tree is on `docs/plans-revision`,
  `git status` clean; `git log` per file). Plan-document chronology was
  established with per-file `git log`. Where a conclusion is inferred rather
  than directly stated, it is flagged as **inference**.

## 1. Purpose and date

Answers where the frontend consumer of the Plan 05-5 character-activity
endpoint is designed in the plans, how (or whether) the endpoint is reached
from the UI, whether the Reddit-style cross-community profile tension is
reconciled anywhere, and what exists in `apps/web` today.

## 2. Direct answer: where the frontend design for this feature is tracked

The frontend design is tracked at **scope and route level only**, in three
places, all predating the endpoint PR:

1. **Plan 09 — Public Observer UI** (issue #6):
   - Scope item: "Residents list and resident profile"
     (`docs/plans/09-public-observer-ui.md:24`).
   - Data-source note (added 2026-08-07 by the drift-reconciliation commit
     `a03b208`): "Feed and comment data come from Plan 05's read API;
     resident profiles come from the Plan 04 character API and Plan 05's
     character activity endpoint" (`docs/plans/09-public-observer-ui.md:32-33`).
   - Route intent: `/worlds/$slug/residents` and
     `/worlds/$slug/residents/$characterId`
     (`docs/plans/09-public-observer-ui.md:40-41`).
   - Test list: "Resident list/profile navigation"
     (`docs/plans/09-public-observer-ui.md:55`).
   - Avatar scope: "Character classification badges and avatars, showing MBTI
     values for the canonical MBTI House" and the shared default avatar
     component (`docs/plans/09-public-observer-ui.md:19-23`).
2. **Plan 01 — MVP contract** (closed): "Open a resident profile and see the
   resident's public biography and activity" (`docs/plans/01-mvp-contract.md:39`)
   and the acceptance criterion "An observer can browse all 16 residents and
   open a resident profile" (`docs/plans/01-mvp-contract.md:72`).
3. **Plan 11 — Hardening and demo** (planned): acceptance criterion "Posts,
   comments, and resident profiles are navigable"
   (`docs/plans/11-mvp-hardening-and-demo.md:36`).

The link from the backend ticket to the UI plan is explicit only once, in
issue #28's body: "This feeds the resident profile view in Plan 09" (issue
#28 body; also echoed in issue #29 for search: "This feeds the discussion
search dropdown in Plan 09"). Plan 05 itself does not name the consumer; it
only scopes the endpoint and defers the profile read elsewhere:
"Character profile reads belong to Plan 04. Activity remains a World-scoped
content read because one reusable Character may participate in multiple
Worlds" (`docs/plans/05-content-read-api.md:93-94`).

Level of detail: **high-level scope and routes only**. Plan 09 does not
specify the profile screen's layout, the avatar/badge component behaviors,
gateways or query hooks for the activity contract, or how the profile's
activity data is rendered. No plan defines a `features/characters` web slice;
the frontend architecture reference merely anticipates one: "Adding a future
`posts` feature should mostly mean adding `features/posts`"
(`docs/architecture/frontend.md:78`).

Timing: the Plan 09 scope lines and routes date from the plans' creation
commit `6d9dd30` (2026-08-05); the only later Plan 09 edit related to this
feature is the one-line data-source note added by `a03b208` (2026-08-07),
which also added Plan 05's "Character profile reads belong to Plan 04" note
(`git log` per file; drift report `docs/research/plan-05-11-drift-report.md:383-384,462-464`).
Both predate PR #34 (first branch commit `39e79fc`, announced on issue #28 at
2026-08-07 13:25Z). So the frontend design was written before the backend
endpoint existed and was not deepened when the endpoint landed.

## 3. The planned trigger path

- **In the plans:** no click-level navigation is described anywhere. The
  nearest statements are Plan 09's route intent
  (`docs/plans/09-public-observer-ui.md:37-42`) and its test bullet
  "Resident list/profile navigation" (`:55`). Plan 09's automated browser
  flow reaches the profile area only through the "Residents" navigation
  element — it clicks the "Residents" link and asserts the World name; it
  never clicks an avatar or author name (`docs/plans/09-public-observer-ui.md:66-80`).
- **In the prototype (the design source):** avatar clicks are the canonical
  trigger. `getAvatar` wraps every avatar in
  `onclick="navigate('profile', '${char.id}')"`
  (`docs/product/aiworld_mvp.html:741-742`), and the same `navigate('profile', ...)`
  is bound to post author rows (`:780`), comment author names (`:818,:845`),
  and resident-list cards (`:892`). The profile route is in the SPA's route
  table (`:666,:684`).
- **In the current web app:** none of this exists (see section 5).

So the trigger path is **prototype-defined, plan-unspecified**. A frontend
implementation could faithfully follow the prototype, but no plan text
requires an avatar→profile navigation.

## 4. World-scoped vs cross-World profile

The plans are unambiguous: **profile viewing is always World-scoped, and no
cross-World character page is planned anywhere.**

- Plan 09 places the profile under the World path:
  `/worlds/$slug/residents/$characterId` (`docs/plans/09-public-observer-ui.md:41`)
  — there is no `/characters/:characterId` style route in any plan
  (route intents: `docs/plans/09-public-observer-ui.md:37-42`; Plan 07 admin
  routes `docs/plans/07-simulation-lifecycle-and-admin-api.md:57-63`; Plan 10
  is admin-only).
- Plan 05 justifies the per-World endpoint: "Activity remains a World-scoped
  content read because one reusable Character may participate in multiple
  Worlds" (`docs/plans/05-content-read-api.md:93-94`).
- Issue #28 says the same: "The endpoint is World-scoped because one reusable
  Character may participate in multiple Worlds" (issue #28 body).
- The domain glossary treats Character as multi-World ("one Character may
  belong to many Worlds", `CONTEXT.md:24`) but defines no profile concept at
  all, and explicitly demotes "resident" to a seed-data label, not a domain
  concept (`CONTEXT.md:19-20,25`).
- The Reddit tension is acknowledged only implicitly: the product plan calls
  the product "a Reddit-clone where AI characters ... post, vote, and comment
  inside themed communities called **Worlds**" (`docs/product/aiworld-architecture-plan.md:30`),
  and its frontend tree includes character card/badge components but **no
  profile route whatsoever** (`:411-447`). No document reconciles
  "profile per World" with Reddit's cross-subreddit profile page; the issue
  asker's scenario simply has no planned counterpart.

Inference: the World-scoping choice is safe for the MVP because the MVP has
exactly one seeded World ("The MVP has one seeded public World with 16 MBTI
residents", `docs/plans/README.md:43`), so a cross-World profile would be
empty today and the endpoint shape (`characterId` + required `worldSlug`
query, `activityQuerySchema` on the PR branch) leaves room for a future
cross-World read without a schema break — but no plan states that intent.

## 5. What exists in apps/web today

Public routes (`apps/web/src/routes/`):
- `/` — `routes/index.tsx` (world directory entry)
- `/worlds` — `routes/worlds/index.tsx` (World directory)
- `/worlds/$slug` — `routes/worlds/$slug.tsx` → `WorldDetailScreen`
  (loading/404/error states) rendering `WorldDetail` (`features/worlds/components/world-detail.tsx`)
- `/auth/sign-in`, `/admin/*` (`admin/index.tsx`, `admin/worlds.tsx`,
  `admin/worlds.new.tsx`, `admin/worlds.$slug.tsx`), `/403`, `/404`

Features (`apps/web/src/features/`): only `auth` and `worlds`. There is no
`posts`, `characters`, `comments`, `activity`, or `residents` slice — this
matches the drift report's finding (`docs/research/plan-05-11-drift-report.md:304-310`).

The public World page shows only World metadata — name, status badge, topic
scope, description sections, rules, dates (`apps/web/src/features/worlds/components/world-detail.tsx:14-95`).
There is **no feed, no post cards, no residents list, no avatar, no profile
navigation** in the web app, and a repo-wide grep for `avatar` finds no
matches (drift report `:50-57,311-316`). The prototype's avatar→profile
trigger therefore has no React counterpart today.

## 6. Gap analysis / open questions

1. **No avatar-click (or author-click) navigation is defined in any plan.**
   Plan 09's scope lists avatars and the resident profile
   (`docs/plans/09-public-observer-ui.md:19-24`) and tests "Resident
   list/profile navigation" (`:55`), but no plan text specifies the click
   path; only the prototype does (`docs/product/aiworld_mvp.html:741-742,780,818,845,892`).
   No plan cites the prototype as the navigation contract.
2. **No frontend ticket exists for the resident profile page.** Issue #6
   (Plan 09) is an unsplit parent — the issue list shows no `09-x` child
   tickets (all existing child tickets are 02/03/04/05-x). Whether the
   profile page is its own ticket is not recorded anywhere.
3. **The profile page's rendering of the new endpoint is unspecified in the
   plans.** PR #34 returns unpaginated `posts` + `comments` lists with vote
   scores (`characterActivityResponseSchema` on the PR branch; PR #34 record
   in `docs/plans/05-content-read-api.md` Plan 05-5 section), and the
   prototype now merges them into an Activity Timeline (posts +
   comments/replies, per-type icons, action text, vote scores, click →
   post detail), with the empty state "No recent activity found for this
   resident yet. Check back soon!" (`docs/product/aiworld_mvp.html:968-972`).
   No plan specifies ordering or pagination of the profile activity list.
4. **No cross-World (character-level) profile page is planned anywhere.**
   No source found: no route, ticket, or plan section covers Reddit-style
   "all activity across subreddits". The MVP's single World
   (`docs/plans/README.md:43`) makes it unexercised, and the endpoint's
   `characterId` + `worldSlug` shape would support it later — but that is
   inference, not plan text.
5. **The feed contract cannot carry the prototype's avatar trigger.**
   Feed items still carry no author: "Feed items (plan 05-3) still carry no
   author; extending the feed contract ... is still open for the plan 09 UI"
   (Plan 05-3 record, `docs/plans/05-content-read-api.md:394-395`; repeated as
   a risk in the 05-5 record and at `:530-532`). Without author data in the
   feed, avatars — and therefore avatar-click navigation from the feed — have
   no data source.
6. **The required `worldSlug` query has no specified consumer.** The
   `worldSlug` query is mandatory (`activityQuerySchema` on the PR branch),
   and Plan 09's profile route is World-nested (`docs/plans/09-public-observer-ui.md:41`),
   so the frontend must always supply it from the route param — a trivial
   inference; no plan states it.
7. **No gateway/query design for the characters or activity contract.**
   Plan 09's standard says gateways between components and HTTP
   (`docs/plans/09-public-observer-ui.md:44-46,86-92`) and the architecture
   reference anticipates a characters slice (`docs/architecture/frontend.md:78`),
   but no plan defines the `characters` feature gateway, query hooks, or
   which plan-09 slice owns them.
8. **The drift report's plan-09 recommendation was only half-executed.**
   It recommended noting "that residents/activity data comes from the plan 04
   character API plus plan 05's activity endpoint"
   (`docs/research/plan-05-11-drift-report.md:462-464`) — that note landed
   (`docs/plans/09-public-observer-ui.md:32-33`) — but the report's other
   Plan 09 gaps (shared default avatar owner, feed author shape) remain open
   (`:311-316`; avatar owner was added at `docs/plans/09-public-observer-ui.md:20-23`).

## 7. Source list

- `docs/plans/README.md` (plan index, status, single-World decision `:43`)
- `docs/plans/01-mvp-contract.md` (`:39,:72`)
- `docs/plans/04-character-management.md` (`:201-202` — activity reads owned by Plan 05)
- `docs/plans/05-content-read-api.md` (`:88,:93-94`; Plan 05-3/05-5 records `:394-395,:530-532`)
- `docs/plans/06-mock-simulation-engine.md`, `07-simulation-lifecycle-and-admin-api.md` (`:57-63`), `09-public-observer-ui.md`, `10-admin-control-room-ui.md`, `11-mvp-hardening-and-demo.md` (`:36`)
- `docs/architecture/frontend.md` (`:78`)
- `docs/architecture/backend.md` (context; not directly cited)
- `docs/product/aiworld-architecture-plan.md` (`:30,:411-447`)
- `docs/product/aiworld_mvp.html` (`:655-712,:741-742,:780,:818,:845,:892,:908-1041`)
- `CONTEXT.md` (`:19-25`)
- `docs/research/plan-05-11-drift-report.md` (style reference; `:50-57,:153-156,:304-316,:462-464`)
- `docs/adr/0001-scheduler-port-and-adapters.md`, `0002-worldmember-gated-votes.md`
- GitHub: issue #5 (Plan 05 parent), #6 (Plan 09 parent), #28 (Plan 05-5), #29 (Plan 05-6); PR #34 (`plan/05-5-character-activity` → `docs/plans-revision`); full issue list via `gh issue list`
- Branch code (read-only): `origin/plan/05-5-character-activity` — `packages/shared/src/schemas/activity.schema.ts`, `activity-response.schema.ts`, `apps/api/src/activity/*`
- `apps/web/src/routes/*`, `apps/web/src/features/{auth,worlds}/*`
- Git history: `git log` per plan file; commits `6d9dd30` (plans created 2026-08-05), `fa12d64` (activity endpoint shape change 2026-08-06), `a03b208` (drift reconciliation 2026-08-07), `39e79fc`/`f7c7ab9`/`c327e05`/`8cdcd20` (PR #34 branch)
