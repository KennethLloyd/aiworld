# Plan 10: Admin Control Room UI

Status: Planned
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`.

## Goal

Implement the prototype's terminal-style ADMIN dashboard using real API
contracts and the shared simulation pipeline.

## Scope

- ADMIN route guard and access-denied behavior
- Terminal/control-room visual language
- Simulation Status tab
- Run, Pause, Halt controls
- Speed selector — preset buttons (0.5x, 1x, 2x, 5x, 10x) mapping to the
  range-validated multiplier (0.1-100), with persisted feedback
- Run One Cycle control
- Target Resident and action selectors
- Manual Trigger Job control
- Telemetry and live execution feedback
- World configuration editor
- Character registry and editor
- World member management (list, assign, activate, and deactivate AI
  memberships) — deferred to Plan 12 (#106) on 2026-08-08 while the
  WorldMember join flow is under review; not part of the MVP demo
- Character avatar URL editor with the shared default fallback from Plan 09
- Filterable simulation log viewer
- Log detail view with provider, model, latency, source, prompt, response,
  tokens, cost estimate, and error details where authorized
- CSV export only if supported by the final API contract
- New World creation form (backend world CRUD exists; multi-World creation is
  not an MVP acceptance requirement, but the form is built for admin
  completeness — recorded decision 2026-08-08)
- Secret admin entry trigger (the prototype's hidden header trigger) as the
  control-room shell's entry UX
- Telemetry, demo controls, and the log viewer poll Plan 07's endpoints; no
  real-time streaming in the MVP
- World member management is a separate child ticket (10-4) and includes the
  join flow: assigning an unassigned Character (zero World memberships, per
  `CONTEXT.md`) to a World creates the membership. The finalized membership
  flow is pending a follow-up grilling session and may revise the WorldMember
  contract.

Re-confirm every tab's request and response contracts against Plan 07's
finalized shared schemas before implementation.

## Security Rules

- ADMIN authorization is enforced by NestJS, not only client route guards.
- Public observers never receive prompts, raw responses, or admin telemetry.
- The browser must not store or expose provider credentials.
- HALTED refusal is shown clearly in the UI and remains enforced server-side.

## Tests

- Anonymous users redirect to sign-in.
- Authenticated non-admin users reach 403.
- ADMIN users can load each tab and handle API errors.
- State and speed mutations invalidate relevant queries.
- Manual controls show pending, success, refusal, and failure states.
- Character and World forms validate and preserve unsaved-change behavior.
- Log filters produce correct query requests and rendered results.
- Keyboard navigation and modal focus trapping work correctly.

## Automated Browser Verification

Use environment variables or the agent-browser auth vault. Do not commit
credentials or auth state. The final flow should resemble:

```bash
agent-browser --session aiworld-admin open http://localhost:5173/auth/sign-in
agent-browser --session aiworld-admin wait --load networkidle
agent-browser --session aiworld-admin snapshot -i
agent-browser --session aiworld-admin find label "Email" fill "$ADMIN_EMAIL"
agent-browser --session aiworld-admin find label "Password" fill "$ADMIN_PASSWORD"
agent-browser --session aiworld-admin find role button click --name "Sign in"
agent-browser --session aiworld-admin wait --url "**/admin/**"
agent-browser --session aiworld-admin snapshot -i
agent-browser --session aiworld-admin find text "Simulation Status"
agent-browser --session aiworld-admin find text "Run One Cycle" click
agent-browser --session aiworld-admin wait --text "cycle"
agent-browser --session aiworld-admin snapshot -i
agent-browser --session aiworld-admin screenshot /tmp/aiworld-admin-status.png
agent-browser --session aiworld-admin close
```

Add separate assertions for PAUSED, HALTED refusal, manual action selection,
character editing, log filtering, and logout. Re-snapshot after every tab,
modal, or mutation because refs become invalid after dynamic updates.

## Senior-Level Implementation Standard

Keep shared UI components presentation-only and put admin behavior in the
admin feature slice. Use query invalidation rather than a second client-side
server-state store. Treat route guards as UX and the API's role guard as the
security boundary. Ensure the UI calls commands and mutations rather than
reimplementing simulation behavior.

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
