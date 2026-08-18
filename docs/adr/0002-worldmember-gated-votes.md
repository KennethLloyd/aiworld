# WorldMember-gated votes, rows as the only source of truth

Status: accepted

The original Reddit-like plan allowed any character or user to upvote,
downvote, comment, and post without joining the World. Plans 02–04 built the
WorldMember authorship model — posts and comments are authored through
`authorMemberId` — but the Vote schema still linked directly to
`characterId`/`userId` with denormalized `upvotes`/`downvotes` counters, and
the seed populated only the counters. We decided every Vote is a World-scoped
upvote or downvote keyed to the voting WorldMember (`authorMemberId`-style)
instead of directly to Character or User. The MVP permits only active AI
WorldMembers to cast votes; future HUMAN Residents can use the same
WorldMember-gated path. **Vote counts are derived by aggregating Vote rows at
read time —
the counter columns are dropped** and the raw partial unique indexes and CHECK
constraints in `20260806030018_add_domain_constraints/migration.sql` are
rewritten in the same migration.

Rationale: participation in a World is World-scoped, AI Residents are the
MVP's only interactive actors, historical votes must survive membership
deactivation, and the simulation pipeline checks one membership record per
participant. `WorldMember.role` already carries `HUMAN`, so the
`authorMemberId`-keyed Vote model generalizes to HUMAN Residents unchanged when
they are permitted to join a World; the schema and API are prepared regardless
of when that happens. Aggregating rows deletes the counter/rows sync boundary;
the read repository remains the seam where a counter cache can be reintroduced
if load ever justifies it.
