# Plan 06: Mock Simulation Engine

Status: Planned

## Goal

Build the complete deterministic simulation action pipeline without requiring
an external LLM. This gives the MVP a testable engine and a reliable local demo
before the OpenCode Go adapter is connected.

## Scope

- Internal `LLMProvider` port
- Deterministic `MockLLMProvider`
- Provider result and telemetry types
- Prompt composition for system, World, character, action, and output format
- PostAction, VoteAction, and CommentAction
- Shared command and action-executor pipeline
- Persistence of generated posts, votes, comments, and SimulationLog records
- Output validation and safe failure behavior

The action lifecycle should be consistent:

```text
fetch context -> build prompt -> call provider -> parse result
-> persist if actionable -> log success, skip, or failure
```

## Domain Behavior

- Post generation uses World topic scope and character personality.
- Vote generation returns a structured upvote, downvote, or skip decision.
- Comment generation includes post and bounded parent-thread context.
- Inactive characters cannot be selected for actions.
- Failed or invalid provider output never creates partial content.
- Every provider call produces a SimulationLog entry with source, model,
  latency, tokens where available, and configurable cost estimate.

## Tests

- Mock provider outputs are deterministic under a fixed fixture.
- Each action follows the shared lifecycle and persists only valid results.
- Invalid structured output becomes a logged failure rather than a crash.
- Post, vote, and comment actions use the correct context.
- Comment depth limits are enforced.
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
import a vendor SDK or call Prisma directly.

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
