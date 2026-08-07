# Plan 04: Character Management

Status: Complete

## Goal

Expose reusable AI characters and World memberships through tested backend
feature boundaries so the public application and ADMIN control room can use the
same validated data without coupling a character's identity to one World.

## Scope

- Standalone Character domain record, repository port, and Prisma adapter
- Standalone WorldMember membership record, active state, repository port, and Prisma adapter
- Public character list and detail reads with optional World filtering
- ADMIN character create, update, activate, and deactivate operations
- ADMIN WorldMember list, create, activate, and deactivate operations
- Optional single starting-World assignment during character creation
- Shared request and response Zod contracts, including private ADMIN projections
- Optional generic classification and classification-group validation
- Server-enforced active visibility for anonymous and non-ADMIN requests
- API authorization, conflict handling, and error handling

The frontend editor is implemented in Plan 10. This plan provides the API and
contract foundation it consumes.

## API Intent

- `GET /api/characters` public active-only; ADMIN may filter status
- `GET /api/characters/:characterId` public active-only; ADMIN may see inactive records
- `POST /api/characters` ADMIN, with optional single `worldSlug` starting assignment
- `PATCH /api/characters/:characterId` ADMIN, including deactivation
- `GET /api/world-members` ADMIN membership management list
- `GET /api/world-members/:memberId` ADMIN membership detail
- `POST /api/world-members` ADMIN principal-to-World assignment
- `PATCH /api/world-members/:memberId` ADMIN membership activation/deactivation

WorldMember accepts either a `characterId` or a future `userId`, with the server
deriving the `AI` or `HUMAN` role. Membership deactivation preserves historical
authors and simulation requires both an active Character and active AI
WorldMember in the target World.

Use the shared pagination contract where lists can grow. Do not create a
frontend schema mirror.

Character `classification` and `classificationGroup` are optional generic
strings on the Character record. Membership is a pure principal-to-World link:
a World imposes no classification rules on the characters that join it, so the
Character model does not assume any shared classification vocabulary.

Public responses never include `systemPrompt`. ADMIN responses use a separate
server-selected private projection. Public and ADMIN status filters cannot be
used to bypass server-side authorization or private-field projection.

## Tests

- Repository mapping never returns generated Prisma types.
- Anonymous active character reads succeed through the standalone resource.
- Anonymous character reads cannot return inactive characters, even when a false
  status filter is supplied.
- Anonymous mutations return unauthorized.
- Non-ADMIN mutations return forbidden.
- ADMIN character mutations validate generic fields and persist changes.
- ADMIN membership mutations support AI principals and preserve historical content
  when memberships are deactivated.
- Inactive characters and memberships are excluded consistently from public and
  future simulation queries.
- Controller, service, repository, contract, and e2e boundary tests are added.

## Browser Verification

Use the OpenAPI page to inspect the standalone character and WorldMember
contracts once the endpoints are available:

```bash
agent-browser --session aiworld-characters open http://localhost:3000/api/docs
agent-browser --session aiworld-characters wait --load networkidle
agent-browser --session aiworld-characters snapshot -i
agent-browser --session aiworld-characters find text "characters"
agent-browser --session aiworld-characters find text "world-members"
agent-browser --session aiworld-characters close
```

If the public resident screen is implemented ahead of Plan 10, verify that it
renders 16 residents and uses the character response contract. Otherwise, use
the API e2e tests as the implementation checkpoint and defer UI verification to
Plan 10.

## Senior-Level Implementation Standard

Follow the existing World feature pattern: controller for transport and auth,
service for domain coordination, repository port for persistence, Prisma
adapter for generated types, and response mapper at the HTTP boundary. Keep
character-specific rules out of generic shared UI and keep admin authority on
the server. Keep Character identity independent from World membership; use the
WorldMember feature boundary for assignment and activation.

## Implementation Record

Status: Complete

### Senior-Level Summary

Plan 04 now exposes Characters as reusable standalone AI identities and
WorldMember as the separate assignment boundary. Character creation can
optionally create one initial AI membership, while later assignment and
activation changes use the WorldMember API without coupling Character persistence
to a single World. Public and ADMIN reads share resource paths but receive
server-selected visibility and response projections: non-ADMIN requests are
forced to active records and never receive `systemPrompt`, while ADMIN requests
may inspect inactive records and private prompts. Memberships have their own
active state so historical post and comment authors remain intact.

### Files Changed

- `apps/api/prisma/models/world-member.prisma`
- `apps/api/prisma/migrations/20260806050000_add_world_member_activity/migration.sql`
- `apps/api/src/app.module.ts`
- `apps/api/src/lib/auth/request-access.ts`
- `apps/api/src/lib/openapi/openapi.ts`
- `apps/api/src/characters/`
- `apps/api/src/world-members/`
- `apps/api/src/world/` active-visibility enforcement and safe read defaults
- `apps/api/test/characters-and-world-members.e2e-spec.ts`
- `packages/shared/src/schemas/character.schema.ts`
- `packages/shared/src/schemas/character-response.schema.ts`
- `packages/shared/src/schemas/world-member.schema.ts`
- `packages/shared/src/schemas/world-member-response.schema.ts`
- `packages/shared/src/schemas/query.schema.ts` removed; query booleans use the
  native `z.stringbool()` helper
- `packages/shared/src/index.ts` removed; importers now use direct schema paths
- `docs/architecture/backend.md`
- `docs/plans/README.md`
- `docs/plans/02-domain-model-and-seed.md`
- `docs/plans/04-character-management.md`
- `docs/plans/05-content-read-api.md`
- `docs/plans/10-admin-control-room-ui.md`

### Architecture and SOLID Notes

Character and WorldMember services depend on repository ports, while generated
Prisma types remain inside concrete adapters. Response mappers create separate
public and ADMIN projections at the transport boundary. WorldMember is modeled
as a polymorphic principal boundary so the current AI flow and a future human
membership flow use the same resource without putting user fields on Character.
The persisted membership active flag protects historical authorship and gives
future simulation queries an explicit World-specific participation check.

World-specific classification rules live in the World feature as a
classification-policy registry keyed by World slug. The character domain stays
generic: it has no MBTI knowledge and merely asks the World feature to validate
the classification pair for the Worlds a character belongs to. The registry
grew from the review round that removed `validateMbtiClassification` from the
character domain. Character existence is now checked for every AI membership
creation, not only `mbti-house`.

The review round also removed the `packages/shared` barrel so every consumer
imports the exact schema file it needs, made the World service default to
public (non-ADMIN) reads, and dropped the file-tree listing and feature detail
sections from the high-level backend architecture reference.

A second review round dropped World-specific classification validation
entirely: membership is a pure principal-to-World link, and classification
remains optional generic character data with no per-World enforcement. The
`mbti-house` vocabulary stays in the prototype seed data only.

A third review round replaced the custom `booleanQuerySchema` query helper with
the native Zod 4 `z.stringbool()` string-format schema and removed
`query.schema.ts`.

### Tests Run

- `pnpm --filter @aiworld/api db:generate`
- `pnpm --filter @aiworld/api build`
- `pnpm --filter @aiworld/api exec jest --runInBand` — 83 tests passed
- `pnpm --filter @aiworld/web test` — 118 tests passed
- `pnpm --filter @aiworld/web build`
- `DATABASE_URL=postgres://postgres:postgres@localhost:5432/aiworld pnpm --filter @aiworld/api exec jest --config ./test/jest-e2e.json --runInBand` — 19 tests passed
- `pnpm lint`
- `pnpm format:check`
- PostgreSQL migration deploy including `20260806050000_add_world_member_activity`

### Browser Verification

- `http://localhost:3000/api/docs` loaded successfully in the
  `aiworld-characters` session.
- Accessibility snapshot confirmed `/characters` and `/world-members` routes,
  their ADMIN authorization controls, and the public/private response schemas.

### Known Risks and Follow-Up Work

- The Plan 10 admin UI must consume the standalone Character and WorldMember
  contracts, present the prototype's single starting-World selector, and include
  World member management screens (list, assign, activate, and deactivate).
  Added to the Plan 10 scope in this implementation record.
- Vote ownership semantics are unresolved: votes link directly to `Character` or
  `User` while posts and comments link via `WorldMember`. Plan 05 now owns this
  as a priority task with a recommended WorldMember-gated model.
- Human WorldMember creation is contract- and persistence-ready but remains an
  ADMIN-managed path until human membership product flows are scoped.
- Plan 05 owns resident activity reads; this plan intentionally returns profile
  data only.
- Plan 07 must require both active Character and active AI WorldMember records
  when selecting simulation participants.
