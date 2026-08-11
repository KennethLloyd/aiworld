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
