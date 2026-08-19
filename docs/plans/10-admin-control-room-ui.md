# Plan 10: Admin Control Room UI

Status: In Progress
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
- Run One Action control
- Target AI Resident and action selectors
- Custom Action control
- Telemetry and live execution feedback
- World configuration editor
- Character registry and editor
- World member management (list, assign, and activate or deactivate
  WorldMemberships) — the current MVP UI manages Character-backed AI
  memberships and the join flow for unassigned Characters; the existing
  WorldMember contract remains ready for future User-backed HUMAN memberships
  and participation. Ticket 10-4 is provisional (`needs-triage`)
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
  `CONTEXT.md`) to a World creates a Character-backed AI membership. The
  WorldMember contract also supports future User-backed HUMAN membership and
  participation without coupling User identity to Character.

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
agent-browser --session aiworld-admin find text "Run One Action" click
agent-browser --session aiworld-admin wait --text "action"
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

Status: In Progress — ticket 10-1 / issue #52 implemented; tickets 10-2 through 10-4 remain.

### Senior-Level Summary

Ticket 10-1 establishes the authenticated `/admin` control-room shell with
URL-backed World and tab context, then implements the Simulation Status tab
against the shared Plan 07 simulation contracts. The shell keeps the future
World Config, Agents, and LLM Logs tabs as explicit extension points owned by
the remaining child tickets.

### Files Changed

- Added the admin feature slice: endpoint builders, HTTP gateway, query keys,
  polling hooks, control-room shell, and Simulation Status controls.
- Updated the admin route/search contract, app header navigation, and gateway
  composition.
- Added gateway, route, and mutation/error-state coverage; updated existing
  gateway test fixtures for the new required admin port.

### Architecture and SOLID Notes

- Transport parsing stays at the HTTP adapter boundary and reuses shared
  simulation schemas; components consume the injected `AdminGateway` port.
- TanStack Query owns server state, polling, and invalidation. State/speed
  commands invalidate configuration, while manual actions invalidate telemetry
  and logs.
- The route guard remains UX behavior; NestJS authorization remains the
  security boundary. Public observer payloads are not used by the tab.

### Tests Run

- `pnpm --filter @aiworld/web exec tsc --noEmit --pretty false`
- `pnpm --filter @aiworld/web lint`
- `pnpm --filter @aiworld/web format:check`
- `pnpm install --frozen-lockfile`
- `pnpm --filter @aiworld/api db:generate`
- `pnpm format:check`
- `pnpm lint`
- `pnpm build`
- `pnpm test` — 68 API suites / 504 tests and 38 web files / 171 tests passed

### Browser Verification

The in-app browser verified the anonymous `/admin` redirect to sign-in with the
original target query preserved. Authenticated verification was blocked because
the local admin seed requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`, which are not
configured in this workspace; no credentials were created or stored.

### Known Risks and Follow-Up Work

- The remaining child tickets own the World Config, Agents, and full LLM Logs
  experiences; the shell currently exposes clear placeholders for those tabs.
- Full authenticated browser coverage still needs a configured local admin
  account or agent-browser auth vault.
