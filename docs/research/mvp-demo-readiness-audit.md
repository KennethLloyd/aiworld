# MVP Demo-Readiness Audit — Final Check of the AIWorld MVP Against Prototype, Plans, and Tickets

- Date: 2026-08-08
- Purpose: final pre-demo audit. Find every remaining gap, missing feature, or
  non-functional issue that could hinder the MVP during its demo period,
  re-running the coverage matrix against the NEW ticket set (#39–59), verifying
  dependency/blocking integrity, demo-period readiness per surface, recording
  integrity of the 2026-08-08 session decisions, and producing a final risk
  ledger. Research only; no repo files were modified other than this report.
- Methodology: This report re-reads the two prior audits
  (`docs/research/plan-05-11-drift-report.md`, `docs/research/prototype-coverage-audit.md`,
  incl. its §8 session resolution record, and `docs/research/plan-05-5-frontend-consumer.md`)
  and verifies every stated event against primary sources: the prototype
  `docs/product/aiworld_mvp.html` (full read, 1735 lines), all eleven plans in
  `docs/plans/` (full reads), `docs/plans/README.md`, `CONTEXT.md`, all three
  ADRs, the architecture references, the code (`apps/api/prisma` models +
  migrations + seeds, `apps/api/src/*`, `apps/web/src/routes`/`features`/`core`,
  `packages/shared/src/schemas`, `apps/api/docker-compose.yml`, root and
  workspace `package.json`, `.env.example`, `.github/workflows/ci.yml`), and the
  GitHub tracker via `gh` (all issues and PRs, bodies, labels, blockers,
  checks). Because the plan-05 code lives on non-main branches, the repository
  state was verified three ways: the working tree (`main`, `git status` clean),
  `origin/docs/plans-revision`, and the open PR branches — the relationship
  between them is itself a primary finding. Every claim cites `file:line` or
  an issue/PR number; conclusions inferred rather than directly stated are
  flagged **inference**. Style follows the three prior research notes.

## Executive Summary

Top findings ordered by demo impact (details and citations in §E):

1. **The Plan 05 content-read API is not on `main`.** Tickets #24–27 are
   CLOSED and their PRs #30–33 are MERGED — but into `docs/plans-revision`, a
   branch 14 commits ahead of `main` (merge-base `a03b208`) with no open PR
   back to `main`. `main` has no posts/comments/votes/activity/search modules
   (`apps/api/src/app.module.ts:25-26` registers only world/characters/
   world-members), the Vote model still carries `userId`/`characterId`
   (`apps/api/prisma/models/vote.prisma:5-6`), and the seed still writes
   `upvotes`/`downvotes` counters (`apps/api/prisma/seed-world.ts:104,113,129,140`).
   A fresh clone of the default branch gets none of ADR-0002, the feed, post
   detail, or vote aggregation. The prior audits' citations of
   `apps/api/src/posts/posts.controller.ts:31` etc. describe the branch, not
   `main`.
2. **The three open plan-05 PRs are a 3-deep stack off a non-main base.**
   #34 (activity, `Closes #28`) → `docs/plans-revision`; #35 (search,
   `Closes #29`) → #34's branch; #37 (feed author, `Closes #36`) → #35's
   branch. All checks pass, all unmerged. These are the declared blockers of
   plan-09 tickets 09-2/09-4/09-5 (§B).
3. **Plan-05's implementation records are stranded with the code.** `main`'s
   `docs/plans/05-content-read-api.md` is a 144-line stub (Status: Planned,
   empty record); the 05-2…05-7 per-ticket records the research notes cite
   (e.g. `05:394-395`, `530-532`) exist only on the branches (821-line file on
   `plan/05-7-feed-author`). The plan file, like the code, must come to `main`.
4. **The demo's scheduler runtime path is undecided.** ADR-0001 makes BullMQ
   "the MVP runtime implementation" and the in-process adapter the
   "test/CI/offline" one; plan 07 says "Redis runs in docker-compose for local
   and CI e2e" (`07:77`) — but `apps/api/docker-compose.yml` defines only
   Postgres, and no `bullmq`/`ioredis` dependency exists (`apps/api/package.json`
   dependencies). Nothing states which adapter a local demo uses or how it is
   selected.
5. **The demo-critical end of the ticket chain is parked on a
   needs-triage hold.** 10-4 (#55) has no blockers and no implementer until a
   grilling session; 11-1 (#56) and 11-3 (#58) both block on it, and 11-4
   (#59, "Demo flows and README") blocks on #56–58 — so the README/demo-flow
   work cannot start even when everything else is green.
6. **The root README is still the starter README.** It says characters, posts,
   comments, votes, simulation, and LLM integrations are "future application
   work" (`README.md:15-17`), lists only World CRUD routes (`README.md:86-94`),
   and documents no Redis. Plan 11-4 (#59) owns the rewrite, which is why this
   is risk #5's downstream symptom.
7. **Everything in plans 09/10/11 is genuinely unimplemented** (tickets
   #47–59 all OPEN), so today a cold demo shows only the worlds directory +
   world detail + admin World CRUD + sign-in. The earliest grabbable tickets —
   06-1 (#39) and 09-1 (#47) — are unblocked; nothing in the current graph
   blocks the frontier.
8. **Prototype-chrome coverage is now complete.** The previously-unassigned
   items (OP badge, comment chip, share, avatar→profile clicks, secret admin
   trigger, back navigation, infinite-scroll timeline) are all in ticket
   bodies (#48, #49, #50, #52); World Time is a recorded non-goal
   (`09:42-43`). No prototype item lacks an owner.
9. **Tracker hygiene: two generations of closed duplicate tickets** (#60–80
   and #81–101, byte-identical bodies to #39–59, created/closed 2026-08-07,
   `stateReason: COMPLETED`). Parents correctly reference #39–59, so the
   duplicates are noise, not a blocking risk.
10. **The stale product-plan sections** (Vote ERD `aiworld-architecture-plan.md:176-177,236`,
    vote buttons `:436,464`, `VotesController` `:332-336`, `admin/simulation.tsx`
    `:415-419`) are owned by 11-1 (#56) per the recorded 2026-08-08 decision —
    acceptable-as-is until then.

## A. Coverage Completeness — Prototype vs Tickets

Method: every prototype screen, component, and interaction in
`docs/product/aiworld_mvp.html` was mapped to the new ticket set (#39–59) or
an explicit non-goal. Ticket bodies were read via `gh issue view`.

| # | Prototype item (html:line) | Ticket(s) | Status |
| --- | --- | --- | --- |
| P1 | Worlds landing "Active Simulations" hero + Live badge + 16 Residents (`:150-178`) | 09-1 #47 (body: "prototype's landing copy and Live badge") | COVERED |
| P2 | World three-column layout + left nav + right context sidebar + "Read World Rules" + pulse (`:181-231`) | 09-1 #47 ("three-column World layout") | COVERED |
| P3 | Feed Hot/New toggle, URL-state sort (`:746-749,763-765`) | 09-2 #48 ("Hot/New sorting works through URL state") | COVERED |
| P4 | Post cards: author row + avatar + badge + vote score + comment chip (`:769-799`) | 09-2 #48; feed contract `author`+`commentCount` = #36 (PR #37) | COVERED (depends on unmerged PR) |
| P5 | Post detail + threaded comments + depth styling + OP badge (`:803-882`) | 09-3 #49 ("OP badge derives from author identity") | COVERED |
| P6 | Observer Mode disabled vote/comment/reply/composer + toast (`:774-777,828-832,852-853,868-879`) | 09-2 #48, 09-3 #49, 09-5 #51 ("across the app") | COVERED |
| P7 | Share → copy post link (`:792-793,1570-1580`) | 09-2 #48 ("Share copies the post link") | COVERED |
| P8 | Search dropdown, min-2-chars, empty state, click → post (`:127-131,1090-1119`) | 09-5 #51 + #29 (PR #35) | COVERED (depends on unmerged PR) |
| P9 | Residents grid, card → profile (`:884-906`) | 09-4 #50 | COVERED |
| P10 | Resident profile + merged Activity Timeline, per-type icons, vote scores, click → post, empty state, newest-first (`:908-1041`) | 09-4 #50 + #28 (PR #34); `useInfiniteQuery` per plan 09:32-36 | COVERED (depends on unmerged PR) |
| P11 | About World (premise/rules/topic/rules-of-observation) (`:1043-1087`) | 09-5 #51 (`/worlds/$slug/about`) | COVERED |
| P12 | Mobile bottom nav (`:234-246`) | 09-1 #47, 09-5 #51 | COVERED |
| P13 | Polling for new content (product plan `refetchInterval: 30_000`, `aiworld-architecture-plan.md:468`) | 09-1 #47 ("Polling for new content"), 09-2 #48; load check 11-3 #58 | COVERED |
| P14 | Loading/empty/error/not-found states | 09-1 #47 | COVERED |
| P15 | Observer nav pill + secret admin trigger (`:134-141`) | 09-5 #51 (Observer Mode surface); 10-1 #52 ("secret entry trigger") | COVERED (pill implicitly via Observer Mode; trigger explicit) |
| P16 | Avatars + classification badges + shared default avatar fallback | 09-1 #47 ("Shared default avatar falls back for absent avatarUrl"); badges in #48/#49/#50 | COVERED |
| A1 | Admin passkey login (`:249-266`) | Real BetterAuth sign-in (guard 10-1 #52); prototype passkey is mock-only, product plan `aiworld-architecture-plan.md:481` | COVERED as non-goal |
| A2 | Dashboard chrome + tabs status/world/chars/logs (`:268-295`) | 10-1 #52 (shell + status tab), 10-2 #53, 10-3 #54 | COVERED |
| A3 | Simulation Status: telemetry, speed, Run One Cycle, target/action selectors, Trigger Job, HALTED refusals, live log pane (`:298-363,1618-1729`) | 10-1 #52 + 07-3 #44; live stream = non-goal, polling adopted (10:36-37) | COVERED |
| A4 | World Config editor + New World + status/slug/rules/topic (`:366-410,1375-1437`) | 10-2 #53; New World recorded decision (10:31-33) | COVERED |
| A5 | Agents registry + character editor modal incl. world assignment, active state, prompt (`:413-436,477-527`) | 10-2 #53 | COVERED |
| A6 | World member management (list/assign/activate) | 10-4 #55 (needs-triage hold; plan 10:38-42) | COVERED (held) |
| A7 | LLM Logs: filters, CSV export, expandable detail (provider/model/latency/source/prompt/response/tokens/cost) (`:439-474,1468-1567`) | 10-3 #54 + 07-3 #44; CSV conditional (10:30) | COVERED |
| A8 | HALTED refusal feedback (`:1665-1669,1695-1699`) | 10-1 #52 + 07 state machine (07:44-50) | COVERED |
| A9 | Avatar URL editor with fallback (`:496-498`) | 10-2 #53 + 09-1 #47 fallback | COVERED |
| I1 | Avatar/author-name → profile on all surfaces (`:740-744,780,818,845,893,1019`) | 09-4 #50 ("Avatar and author-name clicks navigate to the profile on all surfaces") | COVERED |
| I2 | Post card → detail; resident card → profile; Back + view history (`:697-705,772,892`) | 09-2/09-3/09-4; back nav asserted 09-4 #50 + plan 09:40 | COVERED |

Remaining uncovered items:

- **Right-sidebar "World Time — Day 42" stat** (`html:223-226`) — the only
  prototype element with no ticket; it is the recorded explicit non-goal
  (`docs/plans/09-public-observer-ui.md:42-43`: "public observers receive no
  simulation-clock projection"). Recorded, not a gap.
- **Prototype's in-memory admin demo controls note** (`html:348`) — by design;
  production uses the shared pipeline (plan 07). Not a gap.
- **Share URL shape**: prototype copies `#post-<id>` hash URLs
  (`html:1573`); plan 09:39 says "Share copies the post URL" (router URL).
  Trivial renderer difference, not ticketed; **inference** — resolved at
  09-2 implementation.
- **Manual Trigger Job request shape** (target resident + action selectors,
  `html:331-347`): plan 07's API intent lists `POST .../simulation/trigger`
  (`07:61`) but does not fix the body schema (targetId/action); plan 10
  re-confirms contracts before implementation (10:44-45). Minor, tracked.

Verdict: coverage is complete — every prototype screen/interaction maps to a
ticket or a recorded non-goal. The only "missing feature" findings are the
unmerged-data-source risks in §B/§E, not coverage holes.

## B. Dependency / Blocking Integrity

Verified via `gh issue view <n>` bodies and PR states; ticket blockers are
declared in body text ("Blocked by" sections) — see §E-11 re native links.

Declared blocker graph (open tickets):

```
#39 06-1 (none)        #47 09-1 (none)
#40 06-2 ← #39         #48 09-2 ← #47, #36
#41 06-3 ← #40         #49 09-3 ← #47
#42 07-1 ← #41         #50 09-4 ← #47, #28, #36
#43 07-2 ← #42         #51 09-5 ← #47, #49, #29
#44 07-3 ← #43         #52 10-1 ← #44      #53 10-2 ← #47
#45 08-1 ← #40         #54 10-3 ← #44      #55 10-4 (none, needs-triage)
#46 08-2 ← #45         #56 11-1 ← #41, #44, #46, #51, #55
                       #57 11-2 ← #44      #58 11-3 ← #44, #51, #55
                       #59 11-4 ← #56, #57, #58
```

Findings:

1. **Unmerged-PR blockers ARE declared where they bite.** #48 blocks on #36
   (PR #37 open), #50 on #28 (PR #34 open) and #36, #51 on #29 (PR #35 open).
   This matches the audit brief's question — 09-2/09-4 reference #36 correctly
   in their blocker lists, and 09-4 references #28. No plan-09 ticket is
   unblocked-but-really-blocked. (The earlier audit's gap "tickets could start
   but are blocked unnecessarily" does not apply to #47 — it truly needs
   nothing beyond merged APIs.)
2. **#50's blocker on #36 is arguably over-cautious.** The Activity Timeline
   needs the activity endpoint (#28), not feed author/commentCount; PR #37
   touches shared post schemas (#50's post-detail click-through consumes), so
   the dependency is defensible. Not a problem — noted.
3. **Blocker cycles: none.** Every chain terminates at #39/#47/#55.
4. **Tickets that could start but are blocked unnecessarily:**
   - 11-1 (#56) and 11-3 (#58) block on #55 (10-4), a needs-triage ticket with
     no implementer and a pending grilling session. The docs consolidation
     (Vote-model write-up, product-plan annotation) and the hardening pass do
     not strictly need member-management UI. This stalls the README/demo-flow
     ticket #59. Highest-value de-blocking action in the graph.
   - #53 (10-2) blocks on #47 only for the shared avatar fallback; harmless.
5. **Plan-README ordering vs tickets:** the index order
   (`docs/plans/README.md:60-72`: 06→07→08 / 09 / 10 → 11) is preserved in the
   ticket graph except #45 (08-1) blocks on #40 (06-2) rather than #39 — it
   needs the exercised port, defensible; and 11-1 (#56) trims plan-11's
   "depends on 08, 09, 10" to key items — fine. Nothing in 06/07 is ignored by
   08/09/10/11: plan 07's resource-path + `@Roles(['ADMIN'])` convention
   (07:54-55) is what 10-1 consumes (not the old `/api/admin/*` idea — drift
   gap closed); plan 06's comment-depth write enforcement is owned by 06-3
   (#41) and plan 09's read-side cap test by 09-3; the WorldMember-gated Vote
   (ADR-0002) is consumed by 05 (done, on branch) and 06-2.
6. **6.1 → 8.1 note:** plan 08's foundation section (08:11-19) correctly
   points at plan 03's shipped `lib/llm` — the as-if-greenfield drift is
   closed.
7. **Parent issues list their children** (#3→#39-41, #5→#36 (plus closed #24-27),
   #6→#47-51, #8→#56-59, #9→#42-44, #10→#45-46, #11→#52-55) — verified in
   parent bodies. Consistent.
8. **10-4 hold is recorded**: ticket #55 labeled `needs-triage`, body "pending
   the WorldMember flow grilling session"; plan 10:38-42 records the same. The
   hold itself is the risk (see §E-5).

## C. Demo-Period Readiness per Surface

Lens: a fresh local setup running a cold demo, per `docs/plans/README.md:123-139`
and the root README. Each surface's status today vs what the prototype
requires.

### Public surfaces

| Surface | Today (`main`) | Needed | Verdict |
| --- | --- | --- | --- |
| Worlds directory | World list + search + pagination + full states (`apps/web/src/routes/worlds/index.tsx`, `world-list.tsx`) | Landing copy + Live badge (09-1 #47) | WORKS TODAY; polish pending |
| World layout | `$slug` detail: name/status/topic/description/rules (world-detail.tsx) | 3-col layout + mobile nav (09-1 #47) | PARTIAL |
| Feed (Hot/New) | **No API on main**; API on `docs/plans-revision` (05-3 PR #32) + author/commentCount on PR #37 | 09-2 #48 + #36 merge | BLOCKED — nothing demoable |
| Post detail + tree | **No API on main** (05-4 on branch, PR #33) | 09-3 #49 | BLOCKED |
| Residents grid | Character API on main (`characters.controller.ts:43-63`) | 09-4 #50 | API ready; UI pending |
| Profile + Activity Timeline | **No activity API on main** (PR #34) | 09-4 #50 + #28 merge | BLOCKED |
| Search | **No search API on main** (PR #35) | 09-5 #51 + #29 merge | BLOCKED |
| About | World fields on main | 09-5 #51 | API ready; UI pending |
| Observer Mode | No human write endpoints anywhere — enforcement is moot at API level (drift report `:317-320`) | Disabled controls + toast (09-2/09-3/09-5) | UI pending; API-safe |
| Polling | none | 09-1 #47, 09-2 #48 | Pending |

### Admin surfaces

| Surface | Today (`main`) | Needed | Verdict |
| --- | --- | --- | --- |
| Sign-in | BetterAuth sign-in + `require-admin` guard + `/403` (sign-in-form.tsx, router/guards/require-admin.ts); admin seed `db:seed:admin` (`apps/api/prisma/seed-admin.ts`, README.md:70-76) | — | WORKS TODAY |
| Control-room shell + tabs | Only admin worlds CRUD (`routes/admin/*`) | 10-1 #52 | Pending |
| Simulation Status tab | None; config seeded PAUSED/mock (`seed-world.ts:152-166`) | 10-1 #52 + 07 (#42-44) | Pending — see Redis risk §E-4 |
| World config editor | Admin worlds CRUD incl. rules/topicScope (world-form.tsx) | New World form + prototype layout (10-2 #53) | PARTIAL |
| Agents registry/editor | Character + membership APIs on main (plan 04) | 10-2 #53, 10-4 #55 | API ready; UI pending |
| LLM Logs viewer | None | 10-3 #54 + 07-3 logs endpoint | Pending |
| HALTED refusal | None | 07 state machine + 10-1 #52 | Pending |

### Simulation / content availability

- **Seeded content exists** on main: 16 characters, 16 AI memberships, 4
  posts, 14 comments, 1 reply, PAUSED config (`docs/plans/02...md:155`; seed
  verified). **Vote rows do not** — they require the branch migration (05-1/05-2).
- **Mock provider needs no credentials/network**: `providerId: 'mock'` is the
  seed default (`seed-world.ts:157,166`); `lib/llm/provider-config.ts:57-59`
  (main) requires no env for mock. The deterministic `MockLLMProvider` itself
  is 06-1 (#39) — pending.
- **BullMQ/Redis**: nothing exists (no dep, no compose service); ADR-0001 says
  BullMQ is the MVP runtime and Redis "runs as a local docker service like
  Postgres" — but the compose file does not define it (`apps/api/docker-compose.yml`
  = postgres only). Whether the demo uses the in-process adapter (allowed:
  "test/CI/offline implementation", ADR-0001:14-15) or BullMQ is **not
  documented anywhere**. Plan 07-2 (#43) will add the adapters; the demo-path
  decision should be recorded with it (§E-4).
- **Long-run content for the demo** (fresh feed beyond seed) is 11-2 #57,
  which needs the admin API (#44). Expected sequencing; nothing else.

### Non-functional

- **Fresh setup steps**: `pnpm install` → `.env` from example → postgres
  compose → `db:generate` → `db:migrate` → `db:seed` → `pnpm dev`
  (`docs/plans/README.md:123-139`) all valid against `main`. Caveats: (a) the
  demo surfaces above need the plan-05 code that is not on `main`; (b)
  `db:migrate` runs `prisma migrate dev` while AGENTS.md verification uses
  `migrate deploy` — cosmetic inconsistency; (c) root README does not document
  Redis or the post-plan-02 API surface (§E-6).
- **Env/secrets**: `apps/api/.env.example` covers `DATABASE_URL`,
  `BETTER_AUTH_*`, `FRONTEND_ORIGIN`, and the LLM block with mock defaults and
  a commented OpenCode Go profile. `toSafeProviderConfig` strips secrets
  (plan 03 record `03:112-113`). Web needs no `.env` locally (Vite proxy,
  README.md:52). Admin creds come from env vars at seed time — nothing
  committed.
- **Polling load**: app-wide throttle 100 req/min/IP (`apps/api/src/app.module.ts:19`).
  Feed poll 30s + activity timeline + search is trivially under at MVP scale;
  verified in 11-3 #58. Acceptable.
- **Pagination/cursor**: feed = shared offset `Paginated` (`packages/shared/src/schemas/pagination.schema.ts:5-10`); activity = keyset `{items, nextCursor}` (PR #34 body; `activity-response.schema.ts` on the branch). Both documented; no correctness issue found in the PR code read.
- **Mobile viewport / a11y**: web app ships skip-link, focus-trap, axe-based tests (shared/accessibility/*); plan 09 tests mobile + reduced motion (09:72-73); 11-3 #58 verifies. Pending with the UI.
- **Browser-flow scripts vs current routes**: plan 11's flow (`/worlds/mbti-house` + find "The MBTI House") runs against the current app. Plan 09's flow's `find text "Residents" click` and plan 10's `find text "Simulation Status"` reference UI that does not exist yet — consistent with the plans' own warning that flows must be updated to match implementation (`README.md:184`). Plan 10's `find label "Email"/"Password"` matches the shipped form (sign-in-form.tsx:36,42). Self-consistent.
- **Visible-failure risks during a demo** (things that look unfinished):
  - Running `main` shows no feed/residents at all (surfaces render world metadata only) — until §E-1 is resolved this is the dominant visible gap.
  - A PAUSED simulation with no content generation if the demo operator does not run the sim — the seeded 4 posts cover the feed, but Run/One-Cycle require 06+07.
  - The product-plan stale sections (Vote ERD etc.) are docs-only, not visible; acceptable per §D.

## D. Recording Integrity — Session Decisions vs Recorded Locations

Each decision listed in the audit brief was verified present in its recorded
location:

| Decision | Recorded in (verified) |
| --- | --- |
| Share adopted (clipboard post link) | `docs/plans/09-public-observer-ui.md:39-40`; ticket #48 body |
| World Time stat = explicit non-goal | `09:42-43` |
| New World form built in plan 10 | `docs/plans/10-admin-control-room-ui.md:31-33`; #53 |
| Admin log polling, no streaming | `10:36-37` |
| Feed contract + `author` + `commentCount` | ticket #36 body; `09:39`; PR #37 |
| Secret admin trigger | `10:34-35`; #52 body |
| Avatar/author → profile on all surfaces | `09:36-38`; #50 body |
| Activity Timeline merged + infinite scroll (`useInfiniteQuery`), replies flattened, real `createdAt` sort | `09:32-36`; #28 + PR #34 (keyset `{items,nextCursor}`, `postTitle`, `kind` union); #50 body |
| Back-navigation assertions | `09:40`; #50 body |
| Plan splits into tickets | #39-59 (parents' bodies list children) |
| Vote UI / `VotesController` = post-MVP human participation | `docs/plans/11-mvp-hardening-and-demo.md:31-35`; #56 body |
| Product-plan infinite-scroll feed = future | product plan itself labels it "(future)" (`aiworld-architecture-plan.md:466`) |
| Tabs over separate admin route | plan 10 scope (tabs); #52; product-plan stale route owned by 11-1 #56 |
| Character profiles World-scoped | `docs/adr/0003-character-profiles-world-scoped.md` (committed) |
| "Resident" observer-facing copy | `CONTEXT.md:19-20` |
| Character may have zero memberships; join creates membership | `CONTEXT.md:24-26`; plan 10:38-42; #55 |
| 10-4 member management incl. join flow; contract may be revised; grilling pending | `10:38-42`; #55 (needs-triage) |

Nothing on the decision list was found unrecorded. Residual notes:

- **OP badge** was not on the decision list but is ticketed (#49 body).
- **Plan-05 records** exist only on branches (see §E-3) — recorded, but not on
  the default branch.
- **Native GitHub blocking links** (AGENTS.md: "native GitHub blocking links")
  could not be found — blocker declarations are body text only (verified: the
  repo's issue-links API returns 404 for every issue). Not a session decision,
  but a process-recording gap (§E-11).

## E. Final Risk Ledger (demo impact order)

| # | Risk | Source | Category | Recommended next action |
| --- | --- | --- | --- | --- |
| 1 | Plan-05 content API stranded on `docs/plans-revision`; `main` lacks feed/detail/votes/activity/search; ADR-0002 schema + vote-row seed not on `main`; closed tickets #24-27 claim done | merge-base `a03b208`; `git branch --contains ccd3a78/9d5777d` → non-main only; no PR `docs/plans-revision → main`; `vote.prisma:5-6`, `seed-world.ts:104` (main); `app.module.ts:25-26` (main) | blocked-on-merge | Open and merge a PR bringing `docs/plans-revision` (or rebased 05-1…05-4) to `main` before any demo; then rebase #34 on `main` |
| 2 | PRs #34/#35/#37 open (all checks green) — activity, search, feed-author are unmerged data sources for 09-2/09-4/09-5; 3-deep stack off a non-main base | `gh pr view 34/35/37` (state OPEN, base `docs/plans-revision`/`plan/05-5-character-activity`/`plan/05-6-discussion-search`); #48/#50/#51 blockers | blocked-on-merge | Merge bottom-up (#34→#35→#37) onto a `main`-based line; update #28/#29/#36 |
| 3 | Plan-05 implementation records + revised plan text exist only on branches; `main` plan 05 is a 144-line stub; research notes cite branch line numbers (`05:394-395`, `530-532`) | `git show origin/main:docs/plans/05-content-read-api.md` (144 lines, Status: Planned) vs `origin/plan/05-7-feed-author:...` (821 lines) | blocked-on-merge | Fold into risk 1's PR (carry the docs with the code) |
| 4 | Demo scheduler runtime undecided: ADR-0001 (BullMQ = MVP runtime) vs compose file (postgres only) vs in-process adapter (offline) — no documented demo path, no deps | ADR-0001:12-16; `07:77`; `apps/api/docker-compose.yml`; `apps/api/package.json` deps | needs-decision | Record in 07-2 (#43): demo runs the in-process adapter unless Redis is documented; add Redis service to compose |
| 5 | 10-4 (#55) needs-triage hold blocks 11-1 (#56) and 11-3 (#58), which block 11-4 (#59 "Demo flows and README") — the demo's final mile parks on a grilling session | #55/#56/#58/#59 bodies | needs-decision | Hold a decision: split the join-flow question from 10-4's list/activate UI so #55 stops blocking 11-1/11-3, or explicitly defer the blockers |
| 6 | Root README is the starter README (characters/votes/simulation described as future work); no content API routes, no Redis, no plan-09/10 routes; fresh-setup docs lead a demo-runner astray | `README.md:15-17,86-94`; owned by 11-4 #59 | needs-implementation (after 1, 2, 5) | Deliver #59 early or as the top of 11-4; meanwhile add a demo README pointer |
| 7 | Plans 09/10/11 UI entirely unimplemented (all tickets #47-59 OPEN); a cold demo today shows only worlds CRUD | `gh issue list` states; `apps/web/src/features` = auth+worlds only | needs-implementation | None — expected frontier; unblock #47 and #39 first (both grabbable now) |
| 8 | Tracker duplicate tickets: two closed generations (#60-80, #81-101) of #39-59 with identical bodies | `gh issue view 60/81` (same body as #39, closed 2026-08-07, `stateReason: COMPLETED`) | acceptable-as-is | Optional hygiene: note in the parent issues that #39-59 are canonical |
| 9 | Product-plan stale sections (Vote ERD `:176-177,236`; vote buttons `:436,464`; `VotesController` `:332-336`; `admin/simulation.tsx` `:415-419`) | `aiworld-architecture-plan.md` (verified); drift report `:42-49` | needs-implementation (owned by 11-1 #56) | Keep on #56; not demo-visible |
| 10 | Blockers declared as body text, not native GitHub blocking links (AGENTS.md requires native links) | issue bodies ("## Blocked by" text); issue-links API 404 | acceptable-as-is | Convert to native links when convenient; not demo-critical |
| 11 | Manual Trigger Job body shape (target/action) unspecified in 07's API intent; 10-1 expects target/action selectors | `07:57-63` vs `10:16-21`; prototype `html:331-347` | needs-decision | Fix the `trigger` request schema in 07-3 (#44) with the selector fields |
| 12 | Minor: `db:migrate` (migrate dev) vs `migrate deploy` in docs; share URL shape (`#post-<id>` hash vs router URL); Observer nav pill not an explicit acceptance criterion | `docs/plans/README.md:128` vs AGENTS.md; `html:1573`; `html:134-137` | acceptable-as-is | Resolve at 09-2/11-4 implementation; low impact |

## Source List

- `docs/product/aiworld_mvp.html` (full read, 1735 lines; router `:655-705`,
  feed `:751-801`, detail `:803-882`, residents `:884-906`, profile/activity
  timeline `:908-1041`, about `:1043-1087`, search `:1090-1119`, admin
  `:248-528,1124-1729`, fixtures `:548-635,1459-1464`)
- `docs/plans/README.md` (index `:58-96`, decisions `:39-56`, verification
  `:123-186`), `docs/plans/01-mvp-contract.md` … `11-mvp-hardening-and-demo.md`
  (full reads; revised-2026-08-07 headers; 05:34-78 priority task; 07:31-67
  scheduler/API; 09:32-43 scope additions; 10:31-42 scope additions;
  11:31-35 vote annotation)
- `docs/research/plan-05-11-drift-report.md`, `docs/research/prototype-coverage-audit.md`
  (incl. §8 resolution record), `docs/research/plan-05-5-frontend-consumer.md`
- `CONTEXT.md:19-26`; `docs/adr/0001-scheduler-port-and-adapters.md`,
  `0002-worldmember-gated-votes.md`, `0003-character-profiles-world-scoped.md`
- `docs/product/aiworld-architecture-plan.md` (`:170-236` ERD/decisions,
  `:405-481` frontend, `:460-468` polling)
- Code (working tree = `main`): `apps/api/prisma/models/{vote,post,world-simulation-config,simulation-log}.prisma`,
  `apps/api/prisma/migrations/` (8 migrations, no 05-1 vote migration),
  `apps/api/prisma/seed-world.ts`, `seed-admin.ts`, `apps/api/src/{app.module.ts,
  world,characters,world-members}/`, `apps/api/docker-compose.yml`,
  `apps/api/.env.example`, `apps/api/package.json`, `apps/web/src/routes/*`,
  `apps/web/src/features/{auth,worlds}/*`, `apps/web/src/router/guards/*`,
  `packages/shared/src/schemas/`, root `package.json`, `README.md`,
  `.github/workflows/ci.yml`
- Branch code (read-only): `origin/docs/plans-revision` (posts/comments/votes
  modules, ADR-0002 Vote model, vote-row seed), `origin/plan/05-5-character-activity`
  (`activity-response.schema.ts`, keyset pagination), `origin/plan/05-6-discussion-search`
  (`search.schema.ts`), `origin/plan/05-7-feed-author` (`post-response.schema.ts`
  feed `author`+`commentCount`, 821-line plan-05 doc)
- Git: `git branch --contains <sha>` for ccd3a78/9f45b55/9d5777d/955b655/
  5ca7553/b001cf6; `git merge-base main origin/docs/plans-revision`;
  per-file logs for plans 07/08/11; `git show f78633b --stat`
- GitHub via `gh`: issues #1-101 (full list, states, labels, bodies,
  blockers, assignees), PRs #30-37 (state, base/head, checks, bodies),
  parents #3/#5/#6/#8/#9/#10/#11 child lists; issue-links API (404)
