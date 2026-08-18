# Plan 06: Mock Simulation Engine

Status: Planned
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`, ADR-0002.

## Goal

Build the complete deterministic simulation action pipeline without requiring
an external LLM. This gives the MVP a testable engine and a reliable local demo
before the OpenCode Go adapter is connected.

## Scope

- Internal `LLMProvider` port built on the existing `lib/llm` foundation
  shipped in Plan 03 (config loader, capability modes, error mapping) rather
  than re-deriving it
- Deterministic `MockLLMProvider`
- Provider result and telemetry types
- Prompt composition for system, World, character, action, and output format
- PostAction, VoteAction, and CommentAction
- Shared command and action-executor pipeline
- Persistence of generated posts, votes, comments, and SimulationLog records
- Output validation and safe failure behavior
- Service-boundary comment depth enforcement (Plan 02's deferred follow-up):
  the write path rejects replies beyond three levels

The action lifecycle should be consistent:

```text
fetch context -> build prompt -> call provider -> parse result
-> persist if actionable -> log success, skip, or failure
```

## Domain Behavior

- Post generation uses World topic scope and character personality.
- Vote generation returns a structured upvote, downvote, or skip decision; an
  upvote or downvote persists one Vote row against the post-05 WorldMember-gated
  schema (ADR-0002), and a skip persists no Vote row and is logged as SKIPPED.
- Comment generation includes post and bounded parent-thread context.
- Comment replies deeper than three levels are rejected at the service
  boundary, not just truncated on read.
- Inactive characters cannot be selected for actions.
- Actions resolve an active Character through its WorldMember in the target World.
- Failed or invalid provider output never creates partial content.
- Every provider call produces a SimulationLog entry with source, model,
  latency, tokens where available, and configurable cost estimate.

## Tests

- Mock provider outputs are deterministic under a fixed fixture.
- Each action follows the shared lifecycle and persists only valid results.
- Invalid structured output becomes a logged failure rather than a crash.
- Post, vote, and comment actions use the correct context.
- Vote actions persist a row only for upvote/downvote; a skip produces no row
  and a SKIPPED log entry.
- Comment depth limits are enforced by the write service; deeper replies are
  rejected, not truncated.
- Repositories are injected through ports in service tests.
- A full mock cycle creates observable persisted content and logs.

## Browser Verification

The engine is backend-first. Verify the API remains available through the
OpenAPI browser and inspect seeded content before and after a test cycle:

```bash
agent-browser --session aiworld-simulation open http://localhost:3000/api/docs
agent-browser --session aiworld-simulation wait --load networkidle
agent-browser --session aiworld-simulation snapshot -i
agent-browser --session aiworld-simulation get title
agent-browser --session aiworld-simulation close
```

Once Plan 07 exposes an admin command endpoint, add an automated browser flow
that triggers one mock cycle and asserts that a success or failure log appears.

## Senior-Level Implementation Standard

Use Strategy and Adapter at the provider boundary, Template Method for the
shared action lifecycle, and a prompt chain only for independently variable
context sections. The engine orchestrates; actions own action-specific work;
logging and cost tracking remain separate services. Do not let action classes
import a vendor SDK or call Prisma directly. The `LLMProvider` port sits on the
Plan 03 `lib/llm` infrastructure (`provider-config.ts`, `provider-error.ts`) —
reuse it, do not reimplement it.

## Implementation Record

Status: In Progress

### Senior-Level Summary

Ticket 39 shipped the provider seam of the simulation engine. The `LlmProvider`
port (an abstract class used as a Nest DI token) lives in
`apps/api/src/simulation/providers` and reuses the Plan 03 `lib/llm`
foundation: `ProviderConfig`, `ProviderError`, and the OpenAI-compatible
contract parsers. The port carries typed requests (system/user prompt plus
target schema), typed results, and telemetry (source, model, latency, tokens,
optional cost estimate). `MockLlmProvider` implements the port
deterministically: it selects the fixture whose id appears in the prompt text
as a whole word, so the same prompt always produces the same output, latency,
and token counts.
Capability modes are explicit: `json-object` and `json-schema` return raw JSON,
`text-json-fallback` wraps the JSON in a markdown code fence and parses it
through the new `parseStructuredTextContent` extractor, and `unsupported`
rejects structured requests with `ProviderCapabilityError`. Usage metadata
`unavailable` omits tokens; `required` and `optional` report fixture tokens or
a deterministic estimate. A fixture can simulate a provider failure (for
example a timeout) so failure paths are testable offline.
`SimulationModule` binds the port to the mock with a default fixture registry
and exports the port for the ticket 40 actions.

### Files Changed

- `apps/api/src/simulation/providers/llm-provider.port.ts` (new)
- `apps/api/src/simulation/providers/mock/mock-llm.provider.ts` (new)
- `apps/api/src/simulation/providers/mock/mock-llm.provider.spec.ts` (new)
- `apps/api/src/simulation/providers/mock/fixtures/mock-llm-fixtures.ts` (new)
- `apps/api/src/simulation/simulation.module.ts` (new)
- `apps/api/src/lib/llm/openai-compatible-contract.ts` (text-to-JSON fallback)
- `apps/api/src/lib/llm/openai-compatible-contract.spec.ts`
- `apps/api/src/app.module.ts`

### Architecture and SOLID Notes

The port is an abstract class so NestJS binds implementations through one DI
token, matching the repository-port convention. The mock is an adapter behind
that port; simulation code never sees mock or vendor details. The fallback
extractor lives in `lib/llm` so the Plan 8 adapter reuses it instead of
re-deriving it. No generated Prisma types and no network access appear in this
ticket.

### Tests Run

- `pnpm --filter @aiworld/api test` — 37 suites, 201 tests passed
- `pnpm --filter @aiworld/api exec tsc --noEmit` — only pre-existing errors in
  `src/search` and `test/character-activity.e2e-spec.ts` (present on `main`)
- `pnpm --filter @aiworld/api lint`
- `pnpm --filter @aiworld/api format:check`
- `pnpm --filter @aiworld/api build`

### Browser Verification

Backend-only ticket; API behavior is unchanged and no browser flow applies.

### Known Risks and Follow-Up Work

- The mock matches a fixture when its id appears in the prompt text as a whole
  word; ticket 40 prompt builders must include the fixture id.
- `costEstimateUsd` is typed but not filled; ticket 41 adds the configurable
  cost estimate.
- Plan 8 adds the provider registry/factory and the real adapter.

### Ticket 40 (Plan 06-2): Simulation action pipeline

#### Senior-Level Summary

Ticket 40 wired the action pipeline end to end: fetch context, build prompt,
call the mock provider, parse the result, and produce an actionable decision.
`SimulationContextProvider` is the single seam the actions touch for data: it
resolves an actor only when the World, the Character, and its WorldMember
membership are all active (the membership lookup is the new
`findActiveByWorldAndCharacter` port method), and it scopes post/thread lookups
to the target World. Each action is a strategy registered in Nest DI; the
abstract `SimulationAction` base class is a Template Method implementing the
shared lifecycle and turning every failure (inactive actor, missing target,
provider error) into a typed `failed` outcome instead of a crash, so ticket 41
can log it. Prompts are composed by `composeActionPrompt`: standing
instructions and the output format go to the system prompt, the World,
character, and target/thread sections to the user prompt — and the action
keyword (POST/VOTE/COMMENT) appears in the system prompt, which is what the
mock provider's whole-word fixture matching needs. `SimulationActionExecutor`
dispatches a serializable `SimulationCommand` to the right action strategy.
Persistence of decisions and SimulationLog rows is deliberately left to ticket
41.

Two adjacent fixes were required for the pipeline to actually work. The shared
mock fixture registry was reordered to `vote, comment, post` because vote and
comment prompts mention the word "post" (the target post section) and the mock
picks the first fixture whose id appears as a whole word — `post` had to come
last or it would always win. And `loadProviderConfig` now treats empty-string
env values as absent, because a `.env` with `LLM_MODEL=` would otherwise make
the module factory throw before any action could run.

#### Files Changed

- `apps/api/src/simulation/actions/simulation-action-type.ts` (new)
- `apps/api/src/simulation/actions/simulation-command.ts` (new)
- `apps/api/src/simulation/actions/action-context.ts` (new)
- `apps/api/src/simulation/actions/simulation-action.error.ts` (new)
- `apps/api/src/simulation/actions/simulation-output.schema.ts` (new)
- `apps/api/src/simulation/actions/simulation-decision.ts` (new)
- `apps/api/src/simulation/actions/action-prompt.ts` (new)
- `apps/api/src/simulation/actions/prompt-sections.ts` (new)
- `apps/api/src/simulation/actions/simulation-context-provider.ts` (new)
- `apps/api/src/simulation/actions/simulation-action.ts` (new)
- `apps/api/src/simulation/actions/post.action.ts` (new)
- `apps/api/src/simulation/actions/vote.action.ts` (new)
- `apps/api/src/simulation/actions/comment.action.ts` (new)
- `apps/api/src/simulation/actions/simulation-action-executor.ts` (new)
- `apps/api/src/simulation/actions/stub-llm.provider.ts` (test double, new)
- Specs: `simulation-context-provider`, `action-prompt`, `prompt-sections`,
  `post.action`, `vote.action`, `comment.action`,
  `simulation-action-executor`, `mock-llm-fixtures` (all new)
- `apps/api/src/simulation/simulation.module.ts` (DI wiring)
- `apps/api/src/simulation/providers/mock/fixtures/mock-llm-fixtures.ts`
  (reordered)
- `apps/api/src/world-members/repositories/world-member-repository.interface.ts`
  and `prisma-world-member.repository.ts` (`findActiveByWorldAndCharacter`)
- `apps/api/src/world/world.module.ts` (export `WorldRepository`)
- `apps/api/src/lib/llm/provider-config.ts` (empty-string env handling)

#### Architecture and SOLID Notes

The Template Method base keeps the lifecycle in one place while actions own
their context fetch, prompt, and decision mapping; the provider is an injected
port (Strategy) and the executor is a thin dispatcher over injected action
strategies. `SimulationContextProvider` is the only object that touches
repository ports, so actions depend on one seam instead of four and no action
calls Prisma directly. `SimulationDecision` is a plain discriminated union that
carries exactly what persistence needs (`worldId`, `memberId`, `characterId`,
plus action-specific fields) with no provider or persistence concerns attached.
Failure codes are a closed union of provider codes and domain codes.

#### Tests Run

- `pnpm --filter @aiworld/api test` — 45 suites, 240 tests passed (full suite;
  9 simulation suites, 48 simulation tests)
- `pnpm --filter @aiworld/api exec tsc --noEmit` — only the pre-existing errors
  in `src/search` and `test/character-activity.e2e-spec.ts` (present on `main`)
- `pnpm --filter @aiworld/api lint`
- `pnpm --filter @aiworld/api format:check`
- `pnpm --filter @aiworld/api build`
- Root: `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build`

#### Browser Verification

Backend-only ticket; the public API surface is unchanged and no browser flow
applies. Plan 07 adds the admin command endpoint that will expose a browser
flow.

#### Known Risks and Follow-Up Work

- The fixture-order invariant in `mockLlmFixtures` (vote, comment, post) is
  load-bearing: any future action whose prompt contains an earlier fixture id
  as a whole word must be tested. The `mock-llm-fixtures.spec.ts` suite guards
  the current three actions.
- `CommentAction` prefers the provider's `parentCommentId` and falls back to
  the command's; ticket 41 enforces the three-level reply depth on the write
  path.
- Ticket 41 persists decisions, writes SimulationLog rows (including the
  SKIPPED status for a `skip` vote), and adds the configurable cost estimate.

### Ticket 41 (Plan 06-3): Persistence, validation, and comment depth enforcement

#### Senior-Level Summary

Ticket 41 completed the engine: a full mock cycle now persists real content and
writes a SimulationLog row for every provider call, and the write path rejects
invalid or failed output instead of creating partial rows.

Persistence lives in `SimulationContentWriter`, the only place generated content
is written. It dispatches on the `SimulationDecision` union and goes through
repository ports (`PostRepository.create`, `VoteRepository.create`, and
`CommentRepository.create`/`findById`) so the Prisma boundary stays inside the
adapters and tests inject doubles. Comment depth is enforced here, on the write
path: a reply whose parent is missing, belongs to another post, or sits at the
three-level limit is rejected with a `SimulationWriteError`
(`COMMENT_PARENT_NOT_FOUND`, `COMMENT_PARENT_POST_MISMATCH`,
`COMMENT_DEPTH_EXCEEDED`) that subclasses the existing action error so the shared
failure mapper handles it — exactly what Plan 02 deferred and Plan 06 required.

Logging is a separate concern. `SimulationLogService` translates every action
outcome into one `SimulationLog` row through the `SimulationLogRepository` port:
success and skip (SKIPPED) rows carry source, model, latency, token count, and a
cost estimate; failed rows carry a `code: message` error and never partial
content. Cost is estimated by `SimulationCostEstimator` from per-model token
rates loaded from `LLM_INPUT_COST_PER_MILLION_USD` / `LLM_OUTPUT_COST_PER_MILLION_USD`
and is only filled when the provider telemetry does not already report a cost.
The `Vote` row for an upvote/downvote is a plain integer value; a skip persists
no row.

The full-cycle integration proof lives in the e2e suite, not in production
code: `test/simulation-cycle.e2e-spec.ts` drives a POST, then VOTE, then
COMMENT on the created post through the real DI graph (executor → writer → log
service) with a test-local helper. An earlier draft shipped this orchestration
as a production `SimulationCycleService`; review showed it had no product
caller — Plan 07's Run One Cycle is one scheduler iteration (one character,
one weighted action through the same command pipeline), never a fixed
POST → VOTE → COMMENT triple — so the service and its result types were
removed. The writer and log service remain the persistence/logging building
blocks the Plan 07 scheduler pipeline will call per command. Log types
(`SimulationExecutionSource`, `SimulationLogStatus`) are plain unions in
`simulation/domain` so the Prisma enums stay inside the adapter. The DI wiring
in `SimulationModule` binds the mock provider, the cost config, the log
repository adapter, and the new services, and registers the new `VotesModule`
for the vote repository port.

#### Files Changed

- `apps/api/src/simulation/domain/simulation-log.ts` (new: log unions, no Prisma
  imports)
- `apps/api/src/simulation/cost/simulation-cost.ts` and
  `simulation-cost-estimator.ts` (+ specs, new)
- `apps/api/src/simulation/logging/simulation-log-record.ts`,
  `simulation-log-repository.interface.ts`, `prisma-simulation-log.repository.ts`,
  `simulation-log.service.ts` (+ spec, new)
- `apps/api/src/simulation/writing/simulation-content-writer.ts` (+ spec, new)
- `apps/api/src/simulation/cycle/simulation-cycle.service.ts`, its spec, and
  `simulation-cycle-result.ts` (added then removed in review: no product caller
  for a fixed POST → VOTE → COMMENT triple; see Known Risks)
- `apps/api/src/votes/votes.module.ts`, `votes/repositories/vote-repository.interface.ts`,
  `votes/repositories/prisma-vote.repository.ts` (new)
- `apps/api/test/simulation-cycle.e2e-spec.ts` (new: test-local full-cycle
  helper drives the executor directly through the real DI graph)
- `apps/api/src/simulation/simulation.module.ts` (DI wiring)
- `apps/api/src/app.module.ts` (register `VotesModule`)
- `apps/api/src/simulation/actions/simulation-action.error.ts` (comment error
  codes and `SimulationWriteError`)
- `apps/api/src/comments/repositories/comment-repository.interface.ts` and
  `prisma-comment.repository.ts` (`findById`, `create`)
- `apps/api/src/posts/repositories/post-repository.interface.ts` and
  `prisma-post.repository.ts` (`create`)
- `apps/api/src/simulation/actions/simulation-context-provider.spec.ts` (mocks)

#### Architecture and SOLID Notes

The writer, logger, and cost estimator are separate injected services (the Plan
06 standard: actions own action-specific work; logging and cost stay separate;
the Plan 07 scheduler command pipeline will own per-command orchestration).
Persistence goes through repository ports with the Prisma adapters
inside them; no action or service imports Prisma or the generated types. The
write path is the single enforcement point for comment depth, so the read-side
`buildCommentTree` truncation remains a UI/read concern only. `SimulationWriteError`
reuses the existing failure taxonomy rather than introducing a parallel one.

#### Tests Run

- `pnpm --filter @aiworld/api test` — 49 suites, 264 tests passed (full suite;
  13 simulation suites, 73 simulation tests; the cycle service spec was removed
  with the service)
- `pnpm --filter @aiworld/api test:e2e` — 10 suites, 98 tests passed
  (includes the `simulation-cycle` suite: the test-local helper drives a full
  POST → VOTE → COMMENT through the real DI graph, persisting a post, vote, and
  comment with three SUCCESS logs carrying source/model/latency/tokens/cost; an
  unresolvable actor logs a FAILED step and creates no content)
- `pnpm --filter @aiworld/api exec tsc --noEmit` — only the pre-existing errors
  in `src/search` and `test/character-activity.e2e-spec.ts` (present on `main`)
- `pnpm --filter @aiworld/api lint`
- `pnpm --filter @aiworld/api format:check`
- `pnpm --filter @aiworld/api build`
- Root: `pnpm test`, `pnpm lint`, `pnpm format:check`, `pnpm build`

#### Browser Verification

Backend-only ticket; the public API surface is unchanged and no browser flow
applies. Plan 07 adds the admin command endpoint; its browser flow triggers
Run One Cycle (one scheduler iteration) and asserts that a success or failure
log appears.

#### Known Risks and Follow-Up Work

- The cost estimate is configurable but simulated; Plan 08 will replace it with
  provider-reported cost when telemetry supplies one.
- Content and its SimulationLog row are written as separate inserts, so an
  infrastructure failure while writing the log would leave the content row
  committed (the step still reports FAILED). This is outside the
  invalid-provider-output guarantee and should be revisited when a transaction
  seam across repository ports is justified.
- Comment depth walks ancestors one hop at a time via `findById`; it is bounded
  because the write path enforces the limit, but a future bulk depth query could
  remove the N+1 if comment trees grow.
- A World that does not exist cannot produce a SimulationLog row (required
  foreign key). The removed cycle service failed fast with no steps in that
  case; with the service gone, that policy moves to the Plan 07 scheduler
  command pipeline.
- The fixed POST → VOTE → COMMENT triple exists only as a test helper in the
  e2e; the Plan 07 scheduler will drive single-action selection from the World
  simulation config weights. Vote target selection remains an open follow-up
  for Plan 07. Self-votes are allowed by design for simulation; the same
  WorldMember-gated rule can support future HUMAN voters, so no exclusion rule
  is planned.
- Plan 07 exposes the admin command endpoint (`RUN_ONE_CYCLE`) and a browser
  flow; Plan 08 adds the provider registry/factory and the real adapter.
