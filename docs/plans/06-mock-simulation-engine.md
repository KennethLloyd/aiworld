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

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
