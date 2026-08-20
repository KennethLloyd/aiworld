# Plan 10: Admin Control Room UI

Status: In Progress
Revised 2026-08-07 per `docs/research/plan-05-11-drift-report.md`.

## Goal

Implement the prototype's terminal-style ADMIN dashboard using real API
contracts and the shared simulation pipeline.

## Reference Artifacts

- [MVP prototype](../product/aiworld_mvp.html) — visual hierarchy, labels,
  layout, and interaction affordances for the terminal-style control room.
- [Simulation lifecycle and admin API](./07-simulation-lifecycle-and-admin-api.md)
  — simulation endpoints, lifecycle rules, polling, and shared contracts.
- [Character management](./04-character-management.md) — Character and
  WorldMember endpoints and projections.
- [`CONTEXT.md`](../../CONTEXT.md) — domain vocabulary and ownership boundaries.

The prototype is a visual and interaction reference only. Do not copy its
in-memory authentication, mock runtime, provider metadata, or prompt/raw-
response display. Production behavior comes from the NestJS authorization
boundary and the shared Zod contracts.

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
  WorldMembers) — ticket 10-4 owns the Members tab and the join flow for
  unassigned Characters. The current MVP UI manages Character-backed AI
  memberships only; User-backed HUMAN membership and participation remain
  post-MVP.
- Character avatar URL editor with the shared default fallback from Plan 09
- Filterable simulation log viewer
- Log detail view with provider, model, latency, execution source, reasoning,
  tokens, cost estimate, status, and error details from the finalized admin
  log contract. Prompt and raw provider response are never rendered because
  they are intentionally excluded from the transport response.
- CSV export is out of scope unless a dedicated API contract is added; do not
  synthesize an export from fields that the API does not expose.
- New World creation form (backend world CRUD exists; multi-World creation is
  not an MVP acceptance requirement, but the form is built for admin
  completeness — recorded decision 2026-08-08)
- Low-visibility admin entry affordance matching the prototype's header
  trigger as UX only; authentication and authorization remain server-side.
- Telemetry, demo controls, and the log viewer poll Plan 07's endpoints; no
  real-time streaming in the MVP
- World member management is a separate child ticket (10-4) and includes the
  join flow: assigning an unassigned Character (zero World memberships, per
  `CONTEXT.md`) to a World creates a Character-backed AI membership. The
  WorldMember contract also supports future User-backed HUMAN membership and
  participation without coupling User identity to Character.

Re-confirm every tab's request and response contracts against the finalized
shared schemas before implementation. The existing `/admin` route guard and
World CRUD routes are the foundation to extend; do not create a parallel admin
surface for behavior that already exists.

## Ticket Ownership

- **10-1 / #52** owns the `/admin` shell, tab navigation, world selector,
  shared admin query utilities, and Simulation Status tab.
- **10-2 / #53** owns World Config, the single Global Character Registry, and
  the Character editor. It does not assign World membership.
- **10-3 / #54** owns the Simulation Logs tab and detail rows.
- **10-4 / #55** owns the Members tab, WorldMember assignment, and membership
  activation/deactivation. It reuses the registry data and does not create a
  second registry.

## Contract Map

The status tab consumes `GET /api/worlds/:slug/simulation`, state and speed
PATCH endpoints, `POST /api/worlds/:slug/simulation/run-one-action`, and
`POST /api/worlds/:slug/simulation/custom-action`, plus telemetry and logs.
Speed presets are presentation choices over the shared 0.1–100 range. RUNNING
and PAUSED allow manual work; HALTED returns the server's refusal response.

The log tab uses `characterId`, `action`, `status`, `executionSource`, `page`,
and `limit` query fields. Log rows expose provider/model, latency, reasoning,
tokens, cost, status, execution source, and error details only.

The Members tab uses the ADMIN-only Character and WorldMember endpoints. An
unassigned Character is a Character with no membership in the selected World;
assignment creates an AI WorldMember. Character activation and membership
activation are separate states and must be displayed separately.

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
- Members list, unassigned-Character assignment, and membership activation /
  deactivation work without exposing HUMAN onboarding controls.
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
character editing, World creation, log filtering/detail, member assignment,
membership activation/deactivation, and logout. Re-snapshot after every tab,
modal, or mutation because refs become invalid after dynamic updates.

## Senior-Level Implementation Standard

Keep shared UI components presentation-only and put admin behavior in the
admin feature slice. Use query invalidation rather than a second client-side
server-state store. Treat route guards as UX and the API's role guard as the
security boundary. Ensure the UI calls commands and mutations rather than
reimplementing simulation behavior.

## Implementation Record

Status: In Progress — ticket 10-1 / issue #52 and ticket 10-2 / issue #53 are implemented on review branches; tickets 10-3 and 10-4 remain.

### Senior-Level Summary

Ticket 10-1 establishes the authenticated `/admin` control-room shell with
URL-backed World and tab context, then implements the Simulation Status tab
against the shared Plan 07 simulation contracts. The shell keeps the future
World Config, Agents, and LLM Logs tabs as explicit extension points owned by
the remaining child tickets.

Ticket 10-2 now fills the World Config and Agents extension points. World Config
reuses the existing World form and mutation flow, while the global Character
registry uses the admin Character projection and shared create/update contracts
for full Character editing, including the admin-only system prompt. Both
editors preserve drafts on API failure and use router-aware accessible discard
confirmation for dirty navigation.

### Files Changed

- Added the admin feature slice: endpoint builders, HTTP gateway, query keys,
  polling hooks, control-room shell, and Simulation Status controls.
- Added the admin World Config and Character registry/editor tabs, including
  shared form mappings, separate public/admin Character gateway ports,
  paginated registry queries, avatar preview fallback, and unsaved-change
  confirmation. The global registry remains available when the World directory
  is empty or unavailable.
- Updated the admin route/search contract, app header navigation, and gateway
  composition.
- Added gateway, form-mapping, route, mutation, dirty-draft, and error-state
  coverage; updated existing Character gateway test fixtures for the expanded
  admin methods.

### Architecture and SOLID Notes

- Transport parsing stays at the HTTP adapter boundary and reuses shared
  simulation and admin Character schemas; components consume injected gateway
  ports and never parse HTTP responses directly.
- TanStack Query owns server state, polling, and invalidation. State/speed
  commands invalidate configuration, while manual actions invalidate telemetry
  and logs.
- The existing World form remains the single presentation boundary for World
  CRUD. The Character editor owns admin-only fields and derives field rules
  from the shared Character request schemas; membership assignment remains
  ticket 10-4's responsibility.
- Dirty editor state is observed at the form boundary and guarded through
  TanStack Router navigation blocking plus an accessible Continue editing /
  Discard changes dialog.
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
- `pnpm test` — 68 API suites / 504 tests and 39 web files / 187 tests passed
- `pnpm build`

### Browser Verification

The in-app browser verified the anonymous `/admin` redirect to sign-in with the
original target query preserved. Authenticated verification was blocked because
the local admin seed requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`, which are not
configured in this workspace; no credentials were created or stored. The
automated route flow covers authenticated World Config and Character editor
interactions through MSW.

### Known Risks and Follow-Up Work

- The remaining child tickets own the full LLM Logs and World Member
  experiences; the shell currently exposes clear placeholders for those tabs.
- Full authenticated browser coverage still needs a configured local admin
  account or agent-browser auth vault.
