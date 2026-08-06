# Plan 02: Domain Model and Prototype Seed

Status: Complete

## Goal

Extend the persistence model from World CRUD to the complete single-World MVP
domain and make a fresh local database produce a useful MBTI House demo.

## Scope

Add Prisma models and migrations for:

- Character
- Post
- Comment with self-referential parent relation
- Vote with AI and future human voter support
- SimulationLog
- WorldSimulationConfig

Update the seed to include:

- World name `The MBTI House`
- World slug `mbti-house`
- JSON description key-value pairs
- Prototype rules and topic scope
- All 16 MBTI residents with handles, generic classification and classification
  group values, avatar seed, biography, traits, active state, and system prompt
- Prototype starter posts and nested comments mapped to relational IDs
- One persisted simulation configuration in a safe local default state

## Data Rules

- All IDs remain UUIDs.
- `description` is JSON and remains represented by the shared record contract.
- Character system prompts are stored as data and are editable by ADMIN users.
- Comment depth is limited to three levels by domain validation.
- Vote uniqueness prevents duplicate votes by the same character and target.
- Every simulation configuration belongs to exactly one World.
- Seed operations are idempotent and safe to rerun locally.

## Expected Files and Boundaries

- `apps/api/prisma/schema.prisma`
- `apps/api/prisma/models/*.prisma`
- New migration files
- `apps/api/prisma/seed-world.ts` or focused seed modules
- Domain records and repository ports in later feature plans
- Shared contracts only when a persisted field crosses the API boundary

Only concrete Prisma adapters may import generated Prisma types. Seed scripts
may use Prisma directly because they are infrastructure composition code.

## Tests

- Prisma migration and generation succeed.
- Seed can run twice without duplicate canonical records.
- All 16 MBTI classifications exist exactly once for the MBTI House.
- Prototype posts, comments, and parent relationships are present.
- JSON description values round-trip through the shared contract.
- Invalid comment depth and duplicate vote cases are rejected at the domain or
  persistence boundary.

## Browser Verification

After the migration and seed, start the API and web app, then verify the
canonical World in the browser:

```bash
agent-browser --session aiworld-seed open http://localhost:5173/worlds/mbti-house
agent-browser --session aiworld-seed wait --load networkidle
agent-browser --session aiworld-seed snapshot -i
agent-browser --session aiworld-seed find text "The MBTI House"
agent-browser --session aiworld-seed screenshot /tmp/aiworld-seed-world.png
agent-browser --session aiworld-seed close
```

The feed may not be implemented yet. At this stage the browser proof is the
canonical World identity, JSON-backed description/rules presentation, and
successful API response. Use `http://localhost:3000/api/docs` to inspect the
response contract when a route is not yet present in the UI.

## Senior-Level Implementation Standard

Use a migration that reflects the domain rather than storing simulation state
in process memory. Keep seed composition deterministic and explicit. Do not
leak generated Prisma models into services or shared contracts. Add indexes for
World, author, timestamps, parent comments, and simulation log filtering based
on actual query requirements.

## Implementation Record

Status: Complete

### Senior-Level Summary

The persistence layer now represents the complete single-World MVP domain rather
than only generic World CRUD. Character, post, comment, vote, simulation log, and
simulation configuration models are separated into feature-owned Prisma files.
Character classification and classification-group fields are generic optional
strings, so MBTI is seed data for this World rather than a schema requirement for
every future character. The seed composes deterministic UUIDs, transactional
upserts, relational author and parent references, and a paused Mock provider
configuration so a fresh database is immediately useful and safe to rerun.

### Files Changed

- `apps/api/prisma/models/auth.prisma`
- `apps/api/prisma/models/world.prisma`
- `apps/api/prisma/models/character.prisma`
- `apps/api/prisma/models/post.prisma`
- `apps/api/prisma/models/comment.prisma`
- `apps/api/prisma/models/vote.prisma`
- `apps/api/prisma/models/simulation-log.prisma`
- `apps/api/prisma/models/world-simulation-config.prisma`
- `apps/api/prisma/migrations/20260806030017_add_mvp_domain/migration.sql`
- `apps/api/prisma/migrations/20260806030018_add_domain_constraints/migration.sql`
- `apps/api/prisma/migrations/20260806030636_make_character_mbti_metadata_optional/migration.sql`
- `apps/api/prisma/migrations/20260806031000_generalize_character_classification/migration.sql`
- `apps/api/prisma/seed-data.ts`
- `apps/api/prisma/seed-world.ts`
- `apps/api/src/seed-data.spec.ts`
- `apps/api/test/seed.e2e-spec.ts`

### Architecture and SOLID Notes

Prisma generated types remain inside seed infrastructure and concrete persistence
adapters. Feature-owned schema files preserve the same vertical-slice direction as
the NestJS modules. Database constraints enforce vote shape, duplicate-vote
prevention, non-negative counters, and one simulation configuration per World;
seed/domain validation enforces the three-level comment depth rule. MBTI fields
are generic optional fields on Character rather than requirements for every future
World. The migration preserves existing MBTI seed values while removing the
MBTI-specific enum and column names from persistence.

### Tests Run

- `pnpm --filter @aiworld/api db:generate`
- `pnpm --filter @aiworld/api exec prisma migrate status`
- `pnpm --filter @aiworld/api exec prisma migrate deploy`
- Fresh PostgreSQL migration deploy, seed twice, and count verification: 16 characters, 4 posts, 14 comments, 1 reply, 1 simulation config
- `pnpm --filter @aiworld/api test` — 55 tests passed
- `DATABASE_URL=... pnpm --filter @aiworld/api test:e2e` — 12 tests passed
- `pnpm format:check`
- `pnpm lint`
- `pnpm build`

### Browser Verification

- `http://localhost:5173/worlds/mbti-house` loaded successfully.
- Accessibility snapshot confirmed `The MBTI House`, topic scope, description fields, and rules.

### Known Risks and Follow-Up Work

- Character, content, and simulation API boundaries remain in Plans 4 through 7.
- Comment depth must also be enforced by the future comment service/API boundary;
  Plan 2 validates seed composition and the persistence model only.
- The local configuration is intentionally `PAUSED` with the Mock provider until
  the simulation lifecycle and provider plans are implemented.
