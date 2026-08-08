# Character profiles are World-scoped; cross-World profiles are post-MVP

Resident profiles (and the `GET /api/characters/:characterId/activity` endpoint)
show a Character's Posts and Comments in one World only. The observer always
views content from inside a World — entering a World first, then navigating
within it — so a Reddit-style cross-community history page has no navigation
surface in the MVP. Participation is WorldMember-gated (see ADR-0002), so a
Character's activity is inherently World-scoped. Decision: profiles stay
World-scoped in the MVP. A cross-World profile would need a new aggregation
endpoint and a cross-World navigation model; revisit only if such a surface is
ever built.
