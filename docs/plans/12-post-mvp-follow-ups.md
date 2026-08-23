# Plan 12: Post-MVP Follow-Ups

Status: In Progress

## Goal

Umbrella tracker for work that comes after the MVP demo: optimizations,
redesigns, and feature extensions deferred during MVP planning. It exists so
deferred work is never lost and never blocks the demo-critical path.

## Scope

- Anything explicitly deferred during MVP planning (e.g., Hot feed
  performance, ticket #105).
- Any ticket graduating from `needs-triage` after a review or grilling
  session (e.g., the WorldMember join-flow review outcome, if deferred past
  the MVP).
- Human participation (User to WorldMember onboarding) once planned.

## Rules

- No child ticket here is required for the MVP demo.
- Post-MVP extensions get new documents, not edits to the MVP architecture
  (see plan 11's docs consolidation).
- A child ticket may graduate to a numbered plan with its own tickets when it
  gets scoped.

## Implementation Record

Status: In Progress

### Senior-Level Summary

Issue #133 adds a production-readiness UX pass across the public observer
surface and admin control room. Admin lifecycle controls now follow the
server-owned transition rules, HALTED exposes only an explicit Run recovery, destructive HALT
requires confirmation, mutations expose pending/elapsed feedback, and recent
activity can open the matching log detail. Public observer actions are
presented as read-only values, while feed and directory refresh failures retain
stale data with retry affordances. Search results distinguish posts from
comments, include the parent post title, highlight matches, and preserve
keyboard/listbox state.

The pass also makes admin tabs discoverable on narrow screens, adds registry
and membership filters, protects world forms with cancel/dirty navigation
guards and persistent actions, improves mobile scanning and header labels, and
adds a stable dark backing plus reduced-motion-safe surfaces.

### Files Changed

- `apps/web/src/features/admin/components/` — admin tabs, lifecycle feedback,
  log deep links, registry/member filters, and dirty-state handling.
- `apps/web/src/features/posts/`, `apps/web/src/features/worlds/`, and
  `apps/web/src/features/search/` — observer read-only states, stale refresh
  recovery, directory/search UX, activity recency, and match highlighting.
- `apps/api/src/search/` and `packages/shared/src/schemas/` — parent post title
  in comment search results.
- `apps/web/src/shared/layout/`, `apps/web/src/styles/` — mobile
  discoverability and stable dark/reduced-motion presentation.

### Architecture and SOLID Notes

Transport changes remain in `packages/shared` and are mapped at the API
boundary. Admin authorization and lifecycle enforcement remain server-owned;
the UI only mirrors valid transitions and reports server failures. Observer
components retain no mutation path. Existing repository/provider seams were
preserved.

### Tests Run

- `pnpm format:check`
- `pnpm lint`
- `pnpm test` — API 71 suites / 517 tests and web 45 files / 208 tests
- `pnpm build`
- `git diff --check`

### Browser Verification

The repository does not expose the required `control-in-app-browser` skill or
an `agent-browser` executable in this environment. Chromium is installed, but
the sandbox prevents local listening sockets (`vite preview` fails with
`EPERM`) and Docker cannot access its socket, so authenticated desktop/mobile
browser flows and review screenshots could not be captured here. Automated
route/component coverage includes public and admin loading, empty, error,
forbidden, mutation, dirty-navigation, search, and observer-read-only states.

### Known Risks and Follow-Up Work

- Direct 1440x900 and iPhone 15 (393x852) visual acceptance, screenshot
  inspection, and authenticated admin smoke remain required in an environment
  with the in-app browser and local services available.
- Vite still reports the existing single bundle above 500 kB; code splitting
  remains a follow-up optimization.
