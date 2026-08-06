# Plan 04: Character Management

Status: Planned

## Goal

Expose the seeded residents through a tested backend feature boundary so the
public application and ADMIN control room can use the same validated data.

## Scope

- Character domain record and repository port
- Prisma repository adapter
- Public character list and detail reads
- ADMIN create, update, activate, and deactivate operations
- Shared request and response Zod contracts
- Optional generic classification and classification-group validation
- Canonical MBTI value validation for the `mbti-house` World
- API authorization and error handling

The frontend editor is implemented in Plan 10. This plan provides the API and
contract foundation it consumes.

## API Intent

- `GET /api/worlds/:slug/characters`
- `GET /api/worlds/:slug/characters/:characterId`
- `POST /api/worlds/:slug/characters` ADMIN
- `PATCH /api/worlds/:slug/characters/:characterId` ADMIN
- Optional delete behavior must preserve historical content and should prefer
  deactivation when deletion would break references.

Use the shared pagination contract where lists can grow. Do not create a
frontend schema mirror.

Character `classification` and `classificationGroup` are optional generic
strings. The canonical `mbti-house` World validates its MBTI values at the
feature boundary, but the base Character model must not require MBTI metadata or
assume that every World shares the same classification vocabulary.

## Tests

- Repository mapping never returns generated Prisma types.
- Anonymous character reads succeed for an active public World.
- Anonymous mutations return unauthorized.
- Non-ADMIN mutations return forbidden.
- ADMIN mutations validate generic fields and World-specific classification rules
  and persist changes.
- Inactive residents are handled consistently by public and simulation queries.
- Controller, service, repository, contract, and e2e boundary tests are added.

## Browser Verification

Use the OpenAPI page to inspect and exercise the public character read contract
once the endpoint is available:

```bash
agent-browser --session aiworld-characters open http://localhost:3000/api/docs
agent-browser --session aiworld-characters wait --load networkidle
agent-browser --session aiworld-characters snapshot -i
agent-browser --session aiworld-characters find text "characters"
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
the server.

## Implementation Record

Status: Planned

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
