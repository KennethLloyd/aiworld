# Plan 05–11 Drift Report

- Date: 2026-08-07
- Methodology: This report compares the assumptions in plans 05–11
  (`docs/plans/05-content-read-api.md` through `docs/plans/11-mvp-hardening-and-demo.md`)
  against the code actually built by plans 01–04: the Prisma schema
  (`apps/api/prisma/models/*.prisma` plus raw migration SQL), the shared Zod
  contracts (`packages/shared/src/schemas/`), the NestJS modules
  (`apps/api/src/world`, `characters`, `world-members`, `lib/llm`), the web app
  (`apps/web/src/routes`, `features`, `core`), and the architecture references
  (`docs/architecture/backend.md`, `docs/architecture/frontend.md`). Plan
  documents 01–04 were read in full, with their Implementation Record sections
  treated as first-party evidence of what was built. Git history
  (`git log --oneline --all -- docs/plans/` and per-file logs) was used to
  detect which plan files 05+ were updated in-flight versus left untouched
  since creation. Every claim below cites file paths and line numbers. Where a
  conclusion is inferred rather than directly stated in a source, the
  inference is flagged explicitly.

## Executive Summary

Top drift findings, ordered by impact on re-planning:

1. **Vote ownership is the central unresolved drift, and it is only half
   reconciled.** Plan 05's "Priority Task: Vote-Ownership Semantics" section
   was added in-flight (commit `9a14c3f`) and recommends a WorldMember-gated
   Vote model, but the actual schema still links `Vote` to `characterId`/`userId`
   (`apps/api/prisma/models/vote.prisma:5-6`), and the partial unique indexes
   enforcing duplicate-vote prevention are raw SQL keyed on those columns
   (`apps/api/prisma/migrations/20260806030018_add_domain_constraints/migration.sql:8-14`).
   The recommendation is paper-only so far; the schema change and constraint
   rewrite are still pending in plan 05's implementation.
2. **Plan 05's vote-aggregation test cannot pass against the seeded data.**
   The seed creates **no Vote rows at all** — seeded vote counts are stored as
   `Post.upvotes` / `Comment.upvotes` counter columns
   (`apps/api/prisma/seed-world.ts:104,113,129,140`). Plan 05 asserts "Votes
   aggregated through the WorldMember-ownership model agree with the seeded
   counts" (`docs/plans/05-content-read-api.md:83-84`), which requires either
   seeding Vote rows or aggregating the counter columns — the plan says
   neither. Internal inconsistency, must be resolved in the plan.
3. **The `docs/product/aiworld-architecture-plan.md` ERD is stale on exactly
   the same point.** Its Vote box still shows `userId (null)` /
   `characterId (nullable)` and design decision #2 still describes the
   character/user vote uniqueness contract
   (`docs/product/aiworld-architecture-plan.md:176-177,236`). The product
   reference was edited during plans 02/03 implementation
   (`git log -- docs/product/aiworld-architecture-plan.md` shows commits
   `e8dfcf9`, `2c59b47`, `4b4f0c2`) but was **not** updated for the
   WorldMember-gated vote recommendation.
4. **The "shared default avatar" promised in plan 02 does not exist.**
   Plan 02's data rules say clients use a shared default avatar when
   `avatarUrl` is absent (`docs/plans/02-domain-model-and-seed.md:39-40`), and
   plans 09/10 assume it (`docs/plans/09-public-observer-ui.md:18-19`,
   `docs/plans/10-admin-control-room-ui.md:24`), but there is no avatar
   component, asset, or fallback logic anywhere in `apps/web/src` (grep for
   `avatar` returns nothing) and no shared schema field for it. No plan 05–11
   owns creating it.
5. **Plans 06–08's LLM provider seam is partially pre-built, but the plans
   don't account for what plan 03 already shipped.** `provider-config.ts`
   (`apps/api/src/lib/llm/provider-config.ts:8-14,70-112,127-142`),
   `provider-error.ts`, and `openai-compatible-contract.ts` already implement
   configuration loading, capability modes (`json-schema`/`json-object`/
   `text-json-fallback`/`unsupported`), and safe error mapping. Plans 06 and 08
   describe these as if they are still to be built, and plan 08's
   "configurable cost estimate" and "provider registry" have no existing
   counterpart beyond the `providerId` string on `WorldSimulationConfig`
   (`apps/api/prisma/models/world-simulation-config.prisma:15`).
6. **Plan 07's `/api/admin/*` endpoint prefix is a new routing convention with
   no precedent in the codebase.** Every existing admin operation lives on the
   resource path with a `@Roles(['ADMIN'])` guard (`apps/api/src/world/world.controller.ts:43-66`,
   `apps/api/src/characters/characters.controller.ts:79-100`,
   `apps/api/src/world-members/world-members.controller.ts:31-32`). Plan 07
   proposes `GET/PATCH/POST /api/admin/worlds/:slug/simulation/*`
   (`docs/plans/07-simulation-lifecycle-and-admin-api.md:38-44`) — implementable,
   but a deliberate new convention that re-planning should make explicit.
7. **Comment depth is enforced only in seed composition, and plan 05's
   read-side framing papers over it.** The three-level depth rule is validated
   only by `validateCommentDepth` in seed data
   (`apps/api/prisma/seed-data.ts:415-423`); plan 02's own record flags that
   the service/API boundary must still enforce it
   (`docs/plans/02-domain-model-and-seed.md:173-174`). Plan 05's test expects
   "comment trees ... stop at the depth cap" (`docs/plans/05-content-read-api.md:78`),
   which is only implementable read-side if writes are capped — that write cap
   lives in plan 06 and is not stated there.
8. **Reconciliation happened only in plans 05, 06, 09, and 10; plans 07, 08,
   and 11 were never touched since creation.** Per-file git logs show plan 05
   (3 commits), 06 (1), 09 (1), 10 (3) were edited in-flight; plans 07, 08, and
   11 have exactly one commit (`6d9dd30`, "docs: add MVP implementation plans").
   See the In-Flight Reconciliation Evidence section for the per-file detail.

## Summary Table

| Plan | Assumption category | Status | Key finding (citation) |
| --- | --- | --- | --- |
| 05 | Vote-ownership semantics | RECONCILED (paper) | Priority Task added in-flight (`docs/plans/05-content-read-api.md:26-58`, commit `9a14c3f`); schema still `characterId`/`userId` (`apps/api/prisma/models/vote.prisma:5-6`) |
| 05 | Vote aggregation vs seeded counts | STALE | No Vote rows seeded; counts are counters (`apps/api/prisma/seed-world.ts:104,113,129,140`) vs test at `docs/plans/05-content-read-api.md:83-84` |
| 05 | Activity endpoint shape | RECONCILED | Moved to `/api/characters/:characterId/activity?worldSlug=...` (`docs/plans/05-content-read-api.md:66`, commit `fa12d64`) |
| 05 | Offset pagination | HOLDS | Shared `Paginated<T>` exists (`packages/shared/src/schemas/pagination.schema.ts:5-10`) |
| 05 | Post/comment endpoints | UNTESTABLE | No post/comment/activity/search controllers exist (`apps/api/src/app.module.ts:25-28`); expected, no contradiction |
| 06 | WorldMember-gated action resolution | RECONCILED | Line added in-flight (`docs/plans/06-mock-simulation-engine.md:35`, commit `2c59b47`); schema supports it (`apps/api/prisma/models/world-member.prisma:12`, `character.prisma:11`) |
| 06 | SimulationLog persistence shape | HOLDS | All fields/enums present (`apps/api/prisma/models/simulation-log.prisma:19-45`) |
| 06 | Vote persistence shape | STALE (coupled) | VoteAction persists rows into the unresolved `characterId`/`userId` model (`vote.prisma:5-6`) until plan 05's priority task lands |
| 06 | LLMProvider port / MockLLMProvider | UNTESTABLE | Plan 03 infra exists (`apps/api/src/lib/llm/provider-config.ts`), port deferred to plan 06 (`docs/plans/03-opencode-provider-spike.md:147-148`) |
| 07 | Persisted lifecycle state | HOLDS | `WorldSimulationConfig` exists, seeded PAUSED (`apps/api/prisma/models/world-simulation-config.prisma:7-23`, `apps/api/prisma/seed-world.ts:147-169`) |
| 07 | Speed presets 0.5x–10x | UNTESTABLE | Schema has unconstrained `Float` (`world-simulation-config.prisma:11`); restriction is new validation |
| 07 | `/api/admin/*` routing | NEW GAP | No admin prefix exists; codebase uses resource paths + `@Roles(['ADMIN'])` (`apps/api/src/world/world.controller.ts:43-66`) |
| 07 | BullMQ/Redis | UNTESTABLE | No bullmq/redis/ioredis dependency in `apps/api/package.json` |
| 08 | Config loader / capabilities | RECONCILED | Already shipped by plan 03 (`apps/api/src/lib/llm/provider-config.ts:8-14,70-112`) — plan reads as if still pending |
| 08 | Registry, retry decorator, adapter | UNTESTABLE | Nothing exists; `providerId` string only (`world-simulation-config.prisma:15`) |
| 08 | No hardcoded pricing | HOLDS | Configurable `costEstimate` Decimal (`simulation-log.prisma:33`); product decision (`docs/product/aiworld-architecture-plan.md:254`) |
| 09 | Classification badges | RECONCILED | Wording changed in-flight (`docs/plans/09-public-observer-ui.md:18-19`, commit `e8dfcf9`); classification optional generic (`packages/shared/src/schemas/character-response.schema.ts:9-10`) |
| 09 | Residents/post UI | UNTESTABLE | No resident/post features exist (`apps/web/src/features/` has auth+worlds only) |
| 09 | Shared default avatar | NEW GAP | Absent from plan 02's promise (`docs/plans/02-domain-model-and-seed.md:39-40`); nothing implemented in web |
| 10 | Admin guard + character/member management API | HOLDS | `require-admin` guard and Character/WorldMember APIs exist (`apps/web/src/router/guards/require-admin.ts`, `apps/api/src/characters/characters.controller.ts`, `apps/api/src/world-members/world-members.controller.ts`) |
| 10 | Member management scope | RECONCILED | Added in-flight (`docs/plans/10-admin-control-room-ui.md:23`, commits `2c59b47`, `4b4f0c2`, `0c76b3b`) |
| 10 | Log detail fields | HOLDS (data) | All fields in `SimulationLog` (`apps/api/prisma/models/simulation-log.prisma:28-36`) |
| 11 | 16 prompts, mock default, config-driven OpenCode Go | HOLDS | Seed data (`apps/api/prisma/seed-data.ts:54-247`), mock default config (`apps/api/src/lib/llm/provider-config.ts:57-59`) |
| 11 | Docs update | STALE (external) | `docs/product/aiworld-architecture-plan.md` ERD still shows old Vote shape (`:176-177,236`) |

## Per-Plan Findings

### Plan 05: Content Read API

**Data model expectations**

- [RECONCILED] The Vote schema must move to a WorldMember-gated ownership
  model (`authorMemberId`-style) before vote aggregation and simulation voting
  (`docs/plans/05-content-read-api.md:26-58`). This section was added in-flight
  (commit `9a14c3f`, 2026-08-07) and matches plan 04's known-risk handoff
  (`docs/plans/04-character-management.md:196-198`). However, the implemented
  schema still has `characterId`/`userId` on Vote
  (`apps/api/prisma/models/vote.prisma:5-6`), so the recommendation is
  reconciled in the plan but not in the schema — the plan must still execute
  the migration. Inference: the raw partial unique indexes
  (`apps/api/prisma/migrations/20260806030018_add_domain_constraints/migration.sql:8-14`)
  keyed on `characterId`/`userId` must be rewritten as part of that change;
  the plan does not mention them.
- [STALE] Test expectation: "Votes aggregated through the WorldMember-ownership
  model agree with the seeded counts and ignore votes from inactive or
  non-member principals" (`docs/plans/05-content-read-api.md:83-84`). The seed
  creates no Vote rows; seeded counts live in the counter columns
  (`apps/api/prisma/seed-world.ts:104,113,129,140`). Aggregating real Vote rows
  would yield 0, contradicting the seeded counts (e.g. post p1 = 89 upvotes,
  `apps/api/prisma/seed-data.ts:256`). The plan must choose: seed Vote rows
  (which the current schema permits), read the counter columns, or drop the
  "agree with seeded counts" assertion.
- [HOLDS] Author resolution through WorldMember: posts/comments are authored
  via `authorMemberId` (`apps/api/prisma/models/post.prisma:4`,
  `apps/api/prisma/models/comment.prisma:4`) with `onDelete: Restrict`
  (`post.prisma:13`, `comment.prisma:13`), so "missing authors / deleted
  targets" in the test list (`docs/plans/05-content-read-api.md:79`) can only
  mean inactive members — deactivation preserves history. Consistent.
- [RECONCILED] Activity endpoint: `/api/characters/:characterId/activity?worldSlug=...`
  (`docs/plans/05-content-read-api.md:66`), changed in-flight from the original
  `/api/worlds/:slug/characters/:characterId/activity` (commit `fa12d64`). The
  CharactersController exists with no activity route yet
  (`apps/api/src/characters/characters.controller.ts:36`); the `worldSlug`
  filter aligns with `CharacterRepository.findWorldSlugs`
  (`apps/api/src/characters/repositories/character-repository.interface.ts:18`).
- [HOLDS] Comment depth cap: plan 02's record explicitly defers depth
  enforcement to the future comment service/API boundary
  (`docs/plans/02-domain-model-and-seed.md:173-174`); seed-side validation
  exists (`apps/api/prisma/seed-data.ts:415-423`). Plan 05's read-side depth
  cap test (`docs/plans/05-content-read-api.md:78`) is implementable only
  because writes are capped elsewhere — plan 06 does not yet state the write
  cap. Coupling gap, see recommendation.

**API intent**

- [UNTESTABLE] Feed/detail/comments/search endpoints
  (`docs/plans/05-content-read-api.md:62-66`) — no post, comment, search, or
  activity controllers exist (`apps/api/src/app.module.ts:25-28`); expected
  for a Planned plan, no contradiction with the world slug-based routing
  pattern (`apps/api/src/world/world.controller.ts:82-97`).
- [HOLDS] Pagination: offset-based `page`/`limit`/`total`/`totalPages` shared
  contract exists (`packages/shared/src/schemas/pagination.schema.ts:5-10`),
  and plan 05 explicitly avoids premature cursor pagination
  (`docs/plans/05-content-read-api.md:69`), matching the architecture note
  (`docs/architecture/backend.md:219`).
- [HOLDS] Public reads never expose admin-only prompt data
  (`docs/plans/05-content-read-api.md:81`): the implemented pattern is public
  vs ADMIN response projections with `systemPrompt` excluded publicly
  (`packages/shared/src/schemas/character-response.schema.ts:19-23`; server-side
  selection at `apps/api/src/characters/characters.controller.ts:50-59`).
- [HOLDS] Shared contracts live in `packages/shared` with no barrel; direct
  schema-file imports are the convention (`docs/plans/04-character-management.md:157-160`).
  Plan 05 must follow it (no `index.ts` re-export exists).

### Plan 06: Mock Simulation Engine

**Data model expectations**

- [RECONCILED] "Actions resolve an active Character through its WorldMember in
  the target World" (`docs/plans/06-mock-simulation-engine.md:35`) — line
  added in-flight (commit `2c59b47`) to absorb the WorldMember authorship
  drift. Schema supports it: `WorldMember.isActive`, `role AI`, unique
  `(worldId, characterId)` membership
  (`apps/api/prisma/models/world-member.prisma:12,2,11`; partial unique index
  `apps/api/prisma/migrations/20260806042000_add_world_membership_and_avatar/migration.sql:80`),
  plus `Character.isActive` (`apps/api/prisma/models/character.prisma:11`).
- [HOLDS] SimulationLog persistence: every field the plan's logging bullet
  requires (`docs/plans/06-mock-simulation-engine.md:37-38`) exists —
  `provider`, `model`, `latencyMs`, `tokensUsed`, `costEstimate`,
  `executionSource`, `status`, `errorMessage`, `promptUsed`, `responseRaw`
  (`apps/api/prisma/models/simulation-log.prisma:19-45`), and the enums match
  the plan's action set (`POST`/`VOTE`/`COMMENT` at `simulation-log.prisma:2-5`).
- [STALE — coupled] Vote persistence: "Persistence of generated posts, votes,
  comments, and SimulationLog records" (`docs/plans/06-mock-simulation-engine.md:19`)
  and "Vote generation returns a structured upvote, downvote, or skip decision"
  (`:32`). The Vote target model is the unresolved plan 05 question — Vote
  still points at `characterId`/`userId` (`apps/api/prisma/models/vote.prisma:5-6`).
  Plan 06 depends on plan 05 (`docs/plans/README.md:60`), so this resolves if
  05 lands first, but the VoteAction persistence shape must be written against
  the post-05 schema. DB CHECK `value IN (-1, 1)`
  (`apps/api/prisma/migrations/20260806030018_add_domain_constraints/migration.sql:7`)
  means "skip" cannot be a row — it must be a SKIPPED SimulationLog entry,
  which matches the plan's logging behavior.
- [HOLDS] Prompt context sources exist: World `topicScope`/`rules`
  (`apps/api/prisma/models/world.prisma:7-8`), Character `systemPrompt`/
  `biography`/`traits` (`apps/api/prisma/models/character.prisma:10,8,9`).

**Dependencies**

- [UNTESTABLE] Internal `LLMProvider` port and deterministic `MockLLMProvider`
  do not exist; plan 03's record explicitly defers them to plan 06
  (`docs/plans/03-opencode-provider-spike.md:147-148`). The provider-config
  seam already shipped (`apps/api/src/lib/llm/provider-config.ts`) is the
  foundation the port should sit on; the plan doesn't reference it.

### Plan 07: Simulation Lifecycle and Admin API

**Data model expectations**

- [HOLDS] Persisted lifecycle state: `WorldSimulationConfig` with
  `state`/`speedMultiplier`/`intervalMs`/`jitterMs`/`actionWeights`/
  `providerId`/`model`, one per World, seeded PAUSED
  (`apps/api/prisma/models/world-simulation-config.prisma:7-23`;
  `apps/api/prisma/seed-world.ts:147-169`). The plan's "state read from
  persisted config, not process memory" (`docs/plans/07-simulation-lifecycle-and-admin-api.md:31-32`)
  matches plan 02's record and the product decision
  (`docs/product/aiworld-architecture-plan.md:256`).
- [HOLDS] RUNNING/PAUSED/HALTED enum exists (`world-simulation-config.prisma:1-5`).
- [UNTESTABLE] Speed presets 0.5x/1x/2x/5x/10x with restricted values
  (`docs/plans/07-simulation-lifecycle-and-admin-api.md:19,55`): `speedMultiplier`
  is an unconstrained `Float` (`world-simulation-config.prisma:11`); preset
  validation is new work.
- [HOLDS] Log filters by character/action/status/execution source
  (`docs/plans/07-simulation-lifecycle-and-admin-api.md:58`): all fields exist
  with matching indexes (`apps/api/prisma/models/simulation-log.prisma:41-44`).

**API intent**

- [NEW GAP] The `/api/admin/worlds/:slug/simulation*` prefix
  (`docs/plans/07-simulation-lifecycle-and-admin-api.md:38-44`) is a routing
  convention with no precedent: every admin operation today is a resource path
  with `@Roles(['ADMIN'])` (`apps/api/src/world/world.controller.ts:43-66`,
  `apps/api/src/characters/characters.controller.ts:79-100`,
  `apps/api/src/world-members/world-members.controller.ts:31-32`). Implementable,
  but re-planning should either adopt the prefix deliberately or mirror the
  existing convention.
- [UNTESTABLE] BullMQ/Redis integration: no `bullmq`/`ioredis` dependency in
  `apps/api/package.json`; the plan must add infrastructure.
- [HOLDS] "Admin controllers ... must never call an LLM provider directly"
  (`docs/plans/07-simulation-lifecycle-and-admin-api.md:47-48`) is consistent
  with the product decision (`docs/product/aiworld-architecture-plan.md:397`).

### Plan 08: OpenCode Go Adapter

- [RECONCILED — partially built] Several plan 08 scope items already shipped
  in plan 03 and are described by plan 08 as if pending: the provider
  configuration loader (`apps/api/src/lib/llm/provider-config.ts:70-112`),
  provider ID selection (`provider-config.ts:8`), capability modes including
  `text-json-fallback` (`provider-config.ts:9-14`) and the capability assert
  helper (`provider-config.ts:127-142`), and safe error mapping
  (`apps/api/src/lib/llm/provider-error.ts`, recorded at
  `docs/plans/03-opencode-provider-spike.md:113-115`). Re-planning should
  reference these as existing foundations, not greenfield.
- [UNTESTABLE] Provider registry, timeout/retry decorator, OpenCode Go
  adapter, response normalization, and "simulation actions remain unchanged"
  (`docs/plans/08-opencode-go-adapter.md:12-19,36-38`) — none exist. Plan 03's
  record flags the open retry/backoff and json-schema-capability verification
  items (`docs/plans/03-opencode-provider-spike.md:139-146`).
- [HOLDS] "Cost estimates remain configurable, not a hardcoded per-token
  billing model" (`docs/plans/08-opencode-go-adapter.md:27-28`): `costEstimate`
  is a configurable `Decimal` (`apps/api/prisma/models/simulation-log.prisma:33`),
  matching product decision #9 (`docs/product/aiworld-architecture-plan.md:254`).
- [HOLDS] Mock retained for offline use (`docs/plans/08-opencode-go-adapter.md:20`):
  `providerId` `mock` requires no environment values
  (`apps/api/src/lib/llm/provider-config.ts:57-59`) and the seed config is
  `providerId: 'mock'` (`apps/api/prisma/seed-world.ts:158`).
- [UNTESTABLE] Credentials never logged (`docs/plans/08-opencode-go-adapter.md:33`):
  the existing `toSafeProviderConfig` already strips secrets
  (`apps/api/src/lib/llm/provider-config.ts:114-125`), so the plan has a
  working precedent to extend.

### Plan 09: Public Observer UI

- [RECONCILED] "Character classification badges and avatars, showing MBTI
  values for the canonical MBTI House" (`docs/plans/09-public-observer-ui.md:18-19`)
  — wording changed in-flight (commit `e8dfcf9`) to reflect that
  classification is generic optional data and MBTI is seed vocabulary
  (`packages/shared/src/schemas/character-response.schema.ts:9-10`;
  `apps/api/prisma/seed-data.ts:58-245`).
- [UNTESTABLE] All feed/post/comment/resident routes
  (`docs/plans/09-public-observer-ui.md:30-35`): the web app currently has only
  `auth` and `worlds` features and `worlds`/`worlds/$slug` public routes
  (`apps/web/src/features/`, `apps/web/src/routes/worlds/index.tsx`,
  `$slug.tsx`). Expected; the architecture anticipates new `posts`/`characters`
  feature slices (`docs/architecture/frontend.md:78`) and the gateway
  composition seam is built for more adapters (`apps/web/src/core/services/gateways.ts:16-18`).
- [NEW GAP] The "shared default avatar" for absent `avatarUrl` is promised in
  plan 02 (`docs/plans/02-domain-model-and-seed.md:39-40`) and assumed by plan
  09's avatar rendering, but no avatar UI, asset, or fallback exists in
  `apps/web/src` (grep for `avatar` finds no matches). `avatarUrl` is nullable
  in the contract (`character-response.schema.ts:11`) — plan 09 must either
  create the shared default or explicitly scope it.
- [UNTESTABLE] Observer Mode disabled composer/vote/reply/comment controls
  (`docs/plans/09-public-observer-ui.md:23`): no such UI exists, and no human
  write endpoints exist either, so "disabled" is currently moot; the product
  decision stands (`docs/plans/README.md:44-45`).
- [UNTESTABLE] Polling for new content (`docs/plans/09-public-observer-ui.md:24`):
  the product reference specifies `refetchInterval: 30_000`
  (`docs/product/aiworld-architecture-plan.md:468`); no polling exists in the
  web app yet.

### Plan 10: Admin Control Room UI

- [HOLDS] Admin guard: `require-admin` route guard exists
  (`apps/web/src/router/guards/require-admin.ts`), with the server as the
  security boundary per the plan's security rules
  (`docs/plans/10-admin-control-room-ui.md:31-35`) and the architecture doc
  (`docs/architecture/frontend.md:231-239`).
- [RECONCILED] World member management scope
  (`docs/plans/10-admin-control-room-ui.md:23`) and the avatar URL editor with
  fallback (`:24`) were added/refined in-flight (commits `2c59b47`, `4b4f0c2`,
  `0c76b3b`). The backing API exists: `world-members` list/create/update with
  exactly-one-principal validation (`apps/api/src/world-members/world-members.controller.ts:39-81`;
  `packages/shared/src/schemas/world-member.schema.ts:3-25`) and character
  create/update with optional starting World (`packages/shared/src/schemas/character.schema.ts:39-57`).
- [HOLDS] Log detail view fields (`docs/plans/10-admin-control-room-ui.md:26-27`):
  every field exists on SimulationLog (`apps/api/prisma/models/simulation-log.prisma:26-36`);
  the ADMIN-only visibility rule is consistent with the implemented
  public/private projection pattern (`character-response.schema.ts:19-23`).
- [UNTESTABLE] Simulation Status/controls (Run/Pause/Halt/speed/Run One
  Cycle/Trigger/telemetry) — depend on plan 07's API; nothing exists.
- [NEW GAP] "Character avatar URL editor with a default fallback"
  (`docs/plans/10-admin-control-room-ui.md:24`) — the fallback still has no
  shared implementation (see plan 09 finding).

### Plan 11: MVP Hardening and Demo

- [HOLDS] "Fresh local setup creates The MBTI House and its 16 residents"
  (`docs/plans/11-mvp-hardening-and-demo.md:26`): seed is idempotent,
  transactional, and verified at 16 characters / 16 AI members
  (`apps/api/prisma/seed-world.ts:23-85`; `docs/plans/02-domain-model-and-seed.md:155`).
- [HOLDS] "Tune the 16 character prompts using SimulationLog evidence"
  (`docs/plans/11-mvp-hardening-and-demo.md:13`): 16 seeded system prompts
  exist (`apps/api/prisma/seed-data.ts:54-247`).
- [HOLDS] "Mock provider works without external credentials" and "OpenCode Go
  can be enabled through configuration" (`docs/plans/11-mvp-hardening-and-demo.md:31-32`):
  mock requires no env (`apps/api/src/lib/llm/provider-config.ts:57-59`);
  non-mock requires `LLM_BASE_URL`/`LLM_API_KEY`/`LLM_MODEL`
  (`provider-config.ts:61-67`).
- [STALE (external doc)] "Update README and architecture references"
  (`docs/plans/11-mvp-hardening-and-demo.md:22`): the architecture references
  are current on backend/frontend (`docs/architecture/backend.md`,
  `frontend.md`), but `docs/product/aiworld-architecture-plan.md` still
  describes the pre-WorldMember Vote shape (`:176-177,236`), so the product
  reference is already out of date relative to plan 05's agreed direction.
- [UNTESTABLE] Everything else (mock simulation run, polling load, mobile/
  accessibility checks) depends on plans 05–10.

## In-Flight Reconciliation Evidence

Per-file git history for plan files 05+ (from `git log --format="%h %ad %s" --date=short`):

| Plan file | Commits touching it (besides creation `6d9dd30`) | Reconciliation content |
| --- | --- | --- |
| `05-content-read-api.md` | `fa12d64` (2026-08-06), `9a14c3f` (2026-08-07) | `fa12d64`: activity endpoint moved from world-scoped to character-scoped. `9a14c3f`: added the full "Priority Task: Vote-Ownership Semantics" section + aggregation test bullet (37 lines added) |
| `06-mock-simulation-engine.md` | `2c59b47` (2026-08-06) | One line: "Actions resolve an active Character through its WorldMember in the target World" |
| `07-simulation-lifecycle-and-admin-api.md` | — (untouched) | — |
| `08-opencode-go-adapter.md` | — (untouched) | — |
| `09-public-observer-ui.md` | `e8dfcf9` (2026-08-06) | Badge wording: MBTI-specific → classification badges showing MBTI for the canonical house |
| `10-admin-control-room-ui.md` | `2c59b47`, `4b4f0c2`, `0c76b3b` (2026-08-06/07) | Avatar URL editor line (2×), World member management scope line |
| `11-mvp-hardening-and-demo.md` | — (untouched) | — |

Conclusion: in-flight reconciliation was targeted but shallow. It absorbed
WorldMember authorship (06), the standalone character API shape (05 activity
endpoint), classification genericity (09), and avatar-optionality (10), and it
delegated the largest unresolved item (Vote ownership) to plan 05 as a
priority task. Plans 07, 08, and 11 contain no WorldMember-era edits at all;
their assumptions were written against the original product plan and the
pre-drift prototype, which is why their drift is concentrated in items like
the `/api/admin/*` convention (07) and the as-if-greenfield provider
foundation (08).

## Reality Gaps Not Covered by Plans 05–11

1. **Vote rows vs vote counters.** The persistence layer maintains both a
   `Vote` table (`apps/api/prisma/models/vote.prisma`) and denormalized
   `upvotes`/`downvotes` counters (`post.prisma:7-8`, `comment.prisma:7-8`)
   with non-negative CHECK constraints
   (`apps/api/prisma/migrations/20260806030018_add_domain_constraints/migration.sql:17-18`).
   The seed populates only the counters. No plan states how the two stay in
   sync (who writes counters — the VoteAction? the read mapper?) or whether
   "vote count aggregation" means counting rows or reading counters. This is
   the most consequential unspecified boundary in the MVP.
2. **Raw-SQL constraints invisible to Prisma.** Vote uniqueness (partial
   indexes), vote shape, and counter non-negativity live only in
   `20260806030018_add_domain_constraints/migration.sql`; the Prisma models
   declare only `@@index`. Any plan that changes the Vote schema (05) must
   coordinate these raw constraints; plan 05 does not mention them.
3. **Shared default avatar missing.** Plan 02 promised client-side default
   (`docs/plans/02-domain-model-and-seed.md:39-40`); nothing exists in web or
   shared. Plans 09/10 assume it; no plan owns it.
4. **`/api/admin/*` routing convention.** New in plan 07; no precedent in the
   implemented API (all admin ops are resource paths + `@Roles`).
5. **Plan 03's provider foundation already exists.** `lib/llm/` shipping
   config/capability/error infrastructure; plans 06 and 08 describe these
   areas without referencing them, creating duplicated-planning risk.
6. **`docs/product/aiworld-architecture-plan.md` is partially stale.** Its ERD
   and key design decisions still describe character/user votes and the old
   frontend `lib/api.ts` shape (`:176-177,236,450-457`); plan 11's "update
   architecture references" (`docs/plans/11-mvp-hardening-and-demo.md:22`)
   only covers README/architecture refs, not the product reference.
7. **No content write path exists at all** (posts/comments/votes are
   persistence-only). Plans 05/06 assume read (05) and simulation-write (06)
   services built from scratch; the only write-adjacent code is seed
   infrastructure (`apps/api/prisma/seed-world.ts`).
8. **Comment depth enforcement gap.** Seed-only validation
   (`apps/api/prisma/seed-data.ts:415-423`); neither plan 05 (read cap) nor
   plan 06 (write cap) explicitly assigns the service-boundary enforcement
   that plan 02 flagged as follow-up (`docs/plans/02-domain-model-and-seed.md:173-174`).

## Recommendations for Re-planning

- **Plan 05 — revise-and-proceed.** The vote-ownership priority task is
  directionally correct and in-plan; re-planning must (a) specify the
  migration of the raw partial unique indexes
  (`20260806030018_add_domain_constraints/migration.sql:8-14`), (b) resolve
  the counter-vs-rows inconsistency in the aggregation test
  (`docs/plans/05-content-read-api.md:83-84` vs `apps/api/prisma/seed-world.ts:104`),
  and (c) state whether the read service returns the counter columns or
  aggregates Vote rows.
- **Plan 06 — revise-and-proceed.** Its WorldMember line (06:35) is current;
  must add: vote persistence against the post-05 schema, ownership of the
  service-boundary comment-depth enforcement plan 02 deferred, and explicit
  reuse of the existing `lib/llm` config/capability/error infrastructure
  (`apps/api/src/lib/llm/provider-config.ts`) as the port foundation.
- **Plan 07 — revise-and-proceed (light).** Persistence assumptions hold. Must
  decide the `/api/admin/*` prefix vs resource-path + `@Roles` convention, add
  speed-preset validation on the unconstrained `speedMultiplier`
  (`world-simulation-config.prisma:11`), and confirm BullMQ/Redis dependency
  addition. Consider noting that plan 04 already requires "active Character
  AND active AI WorldMember" for participant selection
  (`docs/plans/04-character-management.md:203-204`).
- **Plan 08 — revise-and-proceed (light).** Re-point scope at what plan 03
  shipped (config loader, capabilities, error mapping, safe config reporting)
  and write only the delta: registry/factory, adapter, timeout/retry/backoff,
  and the pending json-schema-capability verification
  (`docs/plans/03-opencode-provider-spike.md:139-146`).
- **Plan 09 — revise-and-proceed.** Reconciliations are in place; add an owner
  for the shared default avatar, and note that residents/activity data comes
  from the plan 04 character API plus plan 05's activity endpoint.
- **Plan 10 — fine-as-is with scope confirmation.** Its scope already absorbed
  avatar/member-management edits; only dependency: re-confirm the log-detail
  and control tabs against plan 07's finalized contracts once re-planned.
- **Plan 11 — revise-and-proceed (light).** Add explicit "update
  `docs/product/aiworld-architecture-plan.md` to the WorldMember-era model" to
  the docs-update scope, since that reference is already stale
  (`docs/product/aiworld-architecture-plan.md:176-177,236`).
