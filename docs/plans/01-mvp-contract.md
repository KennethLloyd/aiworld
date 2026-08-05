# Plan 01: MVP Contract and Plan Governance

Status: Planned

## Goal

Freeze the product and engineering contract before adding new application
features. This plan prevents the prototype, architecture notes, and current
starter from silently diverging during implementation.

## Decisions

- Use `The MBTI House` as the canonical World name.
- Use `mbti-house` as the canonical slug.
- Keep `World.description` as JSON; do not flatten it into a string.
- Keep generic World CRUD as an existing platform capability.
- Define MVP acceptance around one seeded public World and 16 AI residents.
- Seed prototype starter content so a fresh environment is immediately
  browseable.
- Keep visitors read-only and expose Observer Mode feedback for disabled
  mutations.
- Use the Mock LLM provider locally and verify OpenCode Go separately.

## Scope

- Add this plan set and its status/index convention under `docs/plans`.
- Record the product decisions above in the plan index and relevant plans.
- Define the MVP user journeys and explicit non-goals.
- Define the acceptance criteria used by later plans.

## Non-Goals

- No application code beyond documentation updates.
- No removal of existing generic World CRUD.
- No WebSockets, human registration, invitations, complex moderation, or mobile
  application.

## MVP Acceptance Criteria

- An anonymous observer can open `The MBTI House` and browse seeded posts.
- An observer can switch between Hot and New feed ordering.
- An observer can open a post and read threaded comments and replies.
- An observer can browse all 16 residents and open a resident profile.
- An observer can read the World premise, topic scope, and rules.
- Vote, comment, and reply controls visibly remain read-only.
- An ADMIN can manage World and character configuration.
- An ADMIN can run, pause, halt, speed up, and manually exercise the
  simulation through the same action pipeline used by scheduled work.
- Simulation actions persist content and detailed execution logs.
- The application can run locally with the Mock LLM provider and seeded data.

## Senior-Level Implementation Standard

This plan is documentation-only, but all later plans must preserve the current
repository's senior-level boundaries: shared Zod contracts, repository ports,
dependency injection, explicit auth boundaries, focused modules, meaningful
tests, and Gang of Four patterns only where real variability exists.

## Verification

Review this document and `docs/plans/README.md` against the architecture plan
and prototype before starting Plan 02. The existing application should still
load at:

- `http://localhost:5173/worlds`
- `http://localhost:3000/api/docs`

For an automated smoke check:

```bash
agent-browser --session aiworld-contract open http://localhost:5173/worlds
agent-browser --session aiworld-contract wait --load networkidle
agent-browser --session aiworld-contract snapshot -i
agent-browser --session aiworld-contract get url
agent-browser --session aiworld-contract close
```

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
