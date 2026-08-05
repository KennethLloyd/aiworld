# Plan 02: Domain Model and Prototype Seed

Status: Planned

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
- All 16 MBTI characters with handles, type, group, avatar seed, biography,
  traits, active state, and system prompt
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
- All 16 MBTI types exist exactly once for the MBTI House.
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

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
