# Plan 10: Admin Control Room UI

Status: Planned

## Goal

Implement the prototype's terminal-style ADMIN dashboard using real API
contracts and the shared simulation pipeline.

## Scope

- ADMIN route guard and access-denied behavior
- Terminal/control-room visual language
- Simulation Status tab
- Run, Pause, Halt controls
- Speed selector with persisted feedback
- Run One Cycle control
- Target Resident and action selectors
- Manual Trigger Job control
- Telemetry and live execution feedback
- World configuration editor
- Character registry and editor
- Character avatar URL editor with a default fallback
- Filterable simulation log viewer
- Log detail view with provider, model, latency, source, prompt, response,
  tokens, cost estimate, and error details where authorized
- CSV export only if supported by the final API contract

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
