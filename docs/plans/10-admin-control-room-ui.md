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
  join flow: assigning a Character with no membership in the selected World
  creates a Character-backed AI membership. That Character may be assigned to
  other Worlds; global unassignment is a separate concept. The WorldMember
  contract also supports future User-backed HUMAN membership and participation
  without coupling User identity to Character.

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

Status: In Progress — tickets 10-1 / issue #52, 10-2 / issue #53, and 10-3 / issue #54 are implemented; ticket 10-4 / issue #55 is implemented on its review branch with a follow-up visual QA pass in progress.

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

Ticket 10-3 now fills the LLM Logs extension point with a typed, World-scoped
viewer. It uses the existing admin gateway and TanStack Query polling to submit
filters, replace each paginated snapshot by stable log ID, and expand only the
authorized SimulationLog response fields. Tab orchestration stays in
`simulation-logs-tab.tsx`, while the table and authorized detail presentation
live in `simulation-log-list.tsx`. Provider prompts and raw responses never
enter the rendered detail surface.

Ticket 10-4 now fills the Members extension point with a typed, selected-World
AI membership manager. It loads all selected-World AI membership pages before
filtering the reusable Character registry, debounces server-side candidate
search, preserves Character and membership activity as separate states, and
uses server-authoritative assignment and activation mutations. HUMAN onboarding
controls remain absent from the MVP surface.

### Files Changed

- Added the admin feature slice: endpoint builders, HTTP gateway, query keys,
  polling hooks, control-room shell, and Simulation Status controls.
- Added the admin World Config and Character registry/editor tabs, including
  shared form mappings, separate public/admin Character gateway ports,
  paginated registry queries, avatar preview fallback, and unsaved-change
  confirmation. The global registry remains available when the World directory
  is empty or unavailable.
- Added the Simulation Logs tab with Character, action, status, and execution
  source filters; expandable authorized details; empty/error states; and
  paginated polling with stable snapshot replacement.
- Added the Members tab with WorldMember gateway/query/mutation boundaries,
  complete selected-World membership loading, joined Character identities,
  responsive member and candidate tables, debounced candidate search,
  assignment, independent Character/membership status, and deactivation
  confirmation.
- Clarified the distinction between globally unassigned and World-unassigned
  Characters in `CONTEXT.md` and recorded the assignment semantics in
  ADR-0004.
- Updated the admin route/search contract, app header navigation, and gateway
  composition.
- Added gateway, form-mapping, route, mutation, dirty-draft, log filtering,
  pagination, detail-visibility, and error-state coverage; updated existing
  Character gateway test fixtures for the expanded admin methods.

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
- The Logs tab consumes the existing injected AdminGateway port and shared
  SimulationLog schemas. TanStack Query owns filter/page keys, background
  polling, and previous-page placeholders; the component never aggregates or
  appends server snapshots client-side.
- `SimulationLogsTab` owns query, filter, pagination, and state transitions;
  `LogList` owns stable-ID row rendering and authorized detail presentation.
- The log detail row is a presentation-only expansion over the public admin log
  response. It renders provider metadata and persisted reasoning/error fields,
  while promptUsed and responseRaw remain absent from the transport contract
  and DOM.
- Dirty editor state is observed at the form boundary and guarded through
  TanStack Router navigation blocking plus an accessible Continue editing /
  Discard changes dialog.
- WorldMember assignment is filtered against a complete selected-World AI
  membership snapshot, while candidate data remains a server-side Character
  registry query. Mutations invalidate WorldMember, admin/public Character,
  World, and active-resident query families; duplicate assignment conflicts
  refresh the same reads without optimistic state.
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
- `pnpm test` — 68 API suites / 504 tests and 43 web files / 202 tests passed
- Focused `/admin` route coverage for log filters, pagination, detail rows,
  empty state, forbidden state, and prompt/raw-response absence.
- Focused WorldMember gateway, pagination, Character identity joining,
  server-side candidate debounce, assignment conflicts, mutation invalidation,
  activation/deactivation, independent forbidden states, and status-distinction
  coverage.

### Browser Verification

The in-app browser verified the authenticated `/admin?tab=members` flow against
the seeded local API at 2560x1440 and an iPhone 15-sized 393x852 viewport. The
flow covered the selected World context, navigation across every admin tab,
the assigned AI resident table, the World-unassigned empty state, server-side
candidate search with the 300ms debounce, assignment of a Character, inactive
candidate disablement, and responsive mobile cards without horizontal
overflow. It also opened the deactivation confirmation, exercised Escape and
Keep active, deactivated a membership, and reactivated it without changing the
Character status. Anonymous access was verified to redirect to sign-in; API
error, forbidden, loading, and independent panel states remain covered by the
focused automated tests.

The follow-up visual QA pass verified all changed admin tabs at the same desktop
and mobile sizes. It removed the duplicate Selected World divider, contained
the UUID inside Telemetry, refactored World Config into responsive identity,
rules, description, and visibility sections, and confirmed the canonical local
seed shows 16 AI Residents. Mobile verification also caught and fixed a
min-content grid overflow in Simulation Status; the final document width equals
the viewport at both sizes.

The complementary `agent-browser` CLI launched the local admin route and
captured the accessible sign-in/admin surface. Its isolated Chrome profile
could not be kept alive between sandbox command invocations, so authenticated
interaction was completed in the in-app browser instead.

Review screenshots were captured and inspected for secrets at:
`/tmp/aiworld-issue-55-fix-desktop-config.png`,
`/tmp/aiworld-issue-55-fix-desktop-status.png`,
`/tmp/aiworld-issue-55-fix-desktop-members.png`,
`/tmp/aiworld-issue-55-fix-mobile-config.png`,
`/tmp/aiworld-issue-55-fix-mobile-status.png`, and
`/tmp/aiworld-issue-55-fix-mobile-members.png`.

### Known Risks and Follow-Up Work

- The browser flow used seeded local data, so the production API error path
  remains covered by the automated forbidden/error tests rather than by
  changing deployed server state.
