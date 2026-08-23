# World-unassigned Character assignment

Status: accepted

## Context

Characters are reusable simulated personas and may belong to more than one
World. The ADMIN control room needs to assign a Character to the selected World
without treating membership as a global Character property. A Character with no
membership anywhere is globally unassigned; a Character that belongs to another
World is still unassigned only in the selected World.

## Decision

The Members tab reads all ADMIN AI WorldMember pages for the selected World and
uses the complete set of `characterId` values to identify World-unassigned
Characters. Candidate search remains a server-side query over the global
Character registry, with the selected-World membership set filtered from its
results. Assignment creates an active AI WorldMember through
`POST /api/world-members`.

Character activation and WorldMember activation remain independent states. An
inactive Character may be displayed as a candidate but cannot be assigned. An
existing active membership that references an inactive Character remains
visible and can still be deactivated or reactivated. Deactivation updates the
existing WorldMember row rather than deleting it, preserving membership
history.

HUMAN onboarding and participation controls are not part of the MVP Members
surface.

## Consequences

- The web client must load all selected-World AI membership pages before
  filtering candidates; a single page is not a complete assignment set.
- Candidate search and membership mutations remain server-authoritative, with
  query invalidation after both successful assignment and assignment conflict.
- The API contract and persistence model already support this decision, so no
  schema or migration change is required.
