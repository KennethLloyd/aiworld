# AIWorld MVP Plans

These documents are the implementation contract for taking the current AIWorld
starter to the MVP. They live in the source repository so plan changes, code
changes, test evidence, and implementation summaries can be reviewed together.

## Source Material

- [Architecture plan](../product/aiworld-architecture-plan.md)
- [MVP prototype](../product/aiworld_mvp.html)
- [Current backend architecture](../architecture/backend.md)
- [Current frontend architecture](../architecture/frontend.md)

The repository architecture references describe implemented behavior. These
plans describe work that extends that behavior. Update the architecture
references only after a planned capability is implemented and stable.

## Current Baseline

The starter already contains:

- NestJS REST API with Prisma, PostgreSQL, Better Auth, and OpenAPI
- World CRUD behind a repository and response-mapper boundary
- React/Vite with TanStack Router and TanStack Query
- Shared Zod request and response contracts
- Public World browsing and ADMIN World management
- Prototype-inspired glassmorphism tokens and accessibility primitives

The MVP adds characters, persisted content, autonomous simulation, LLM
integration, public observer screens, and the admin control room.

## Product Decisions

- The canonical World name is `The MBTI House`.
- The canonical World slug is `mbti-house`.
- The MVP has one seeded public World with 16 MBTI residents.
- `World.description` remains JSON and the shared schema is authoritative.
- The prototype character biographies, traits, handles, prompts, and avatars are
  the starting seed data.
- Prototype starter posts, comments, and replies are seeded so the application
  is browseable before the simulation runs.
- Existing generic World CRUD remains as platform foundation; multi-World
  creation is not an MVP acceptance requirement.
- Visitors are read-only observers. Human post, comment, reply, and vote
  mutations are disabled.
- The Mock LLM provider is the local, test, and offline default. OpenCode Go is
  the supported production-capable MVP adapter after its contract is verified
  and selected through server-side configuration.
- Polling is used for new content. WebSockets are out of scope.

## Plan Status

| Plan | Capability | Depends on | Status |
| --- | --- | --- | --- |
| [01](./01-mvp-contract.md) | MVP contract and plan governance | Current baseline | Complete |
| [02](./02-domain-model-and-seed.md) | Domain model and prototype seed | 01 | In Progress |
| [03](./03-opencode-provider-spike.md) | OpenCode Go contract verification | 01 | Planned |
| [04](./04-character-management.md) | Character persistence and API | 02 | Planned |
| [05](./05-content-read-api.md) | Public content read API | 02, 04 | Planned |
| [06](./06-mock-simulation-engine.md) | Mock simulation action pipeline | 02, 04, 05 | Planned |
| [07](./07-simulation-lifecycle-and-admin-api.md) | Scheduler and admin simulation API | 06 | Planned |
| [08](./08-opencode-go-adapter.md) | OpenCode Go provider adapter | 03, 06 | Planned |
| [09](./09-public-observer-ui.md) | Public observer experience | 05 | Planned |
| [10](./10-admin-control-room-ui.md) | Admin control room | 04, 07 | Planned |
| [11](./11-mvp-hardening-and-demo.md) | Hardening, demo data, and release | 08, 09, 10 | Planned |

## Dependency Flow

```text
Current starter
      |
      v
01 MVP contract
      |
      +--> 02 Domain model and seed --> 04 Characters --> 05 Content API
      |                                      |               |
      |                                      +--> 06 Mock simulation
      |                                                       |
      +--> 03 Provider spike -------------------------------> 08 OpenCode adapter
                                                              ^
                                                              |
                                      06 --> 07 Scheduler/admin API
                                                |             |
                                                v             v
                                      09 Public UI       10 Admin UI
                                                \             /
                                                 v           v
                                             11 Hardening and demo
```

## Senior-Level Engineering Standard

Every implementation plan must meet this standard:

- Preserve the existing dependency direction and feature boundaries.
- Keep Prisma-generated types inside concrete repository adapters.
- Keep transport contracts in `packages/shared` and validate unknown JSON at
  the HTTP boundary.
- Depend on abstractions where there is real variability, especially provider,
  persistence, queue, and action boundaries.
- Apply SOLID and Gang of Four patterns only at genuine seams; do not add
  ceremonial indirection.
- Use dependency injection rather than constructing infrastructure in domain
  services.
- Cover domain decisions with unit tests and boundary behavior with integration
  or end-to-end tests.
- Handle loading, empty, error, disabled, unauthorized, and forbidden states.
- Keep public observer behavior separate from authenticated admin behavior.
- Avoid `any`, duplicated frontend schemas, direct controller-to-Prisma access,
  and UI-only implementations of production behavior.
- Run formatting, linting, type checking, tests, and a browser smoke flow before
  marking a plan complete.

## Local Verification

From the repository root:

```bash
docker compose -f apps/api/docker-compose.yml up -d postgres
pnpm --filter @aiworld/api db:generate
pnpm --filter @aiworld/api db:migrate
pnpm --filter @aiworld/api db:seed
pnpm dev
```

Useful browser checkpoints:

- `http://localhost:5173/worlds`
- `http://localhost:5173/worlds/mbti-house`
- `http://localhost:5173/auth/sign-in`
- `http://localhost:5173/admin`
- `http://localhost:3000/api/docs`

### Automated Browser Testing With agent-browser

Install the CLI once if needed:

```bash
npm i -g agent-browser
agent-browser install
```

Use a named session and the snapshot-interact-verify workflow:

```bash
agent-browser --session aiworld-public open http://localhost:5173/worlds
agent-browser --session aiworld-public wait --load networkidle
agent-browser --session aiworld-public snapshot -i
agent-browser --session aiworld-public find text "The MBTI House" click
agent-browser --session aiworld-public wait --load networkidle
agent-browser --session aiworld-public snapshot -i
agent-browser --session aiworld-public get url
agent-browser --session aiworld-public screenshot /tmp/aiworld-public.png
agent-browser --session aiworld-public close
```

Refs are invalid after navigation or dynamic DOM changes. Always snapshot
again before using a ref. Prefer semantic locators such as `find text`,
`find role`, `find label`, and `find testid` when the UI supports them.

For admin flows, use environment variables or the agent-browser auth vault.
Never put credentials, cookies, or saved auth state in the repository:

```bash
agent-browser --session aiworld-admin open http://localhost:5173/auth/sign-in
agent-browser --session aiworld-admin wait --load networkidle
agent-browser --session aiworld-admin snapshot -i
agent-browser --session aiworld-admin find label "Email" fill "$ADMIN_EMAIL"
agent-browser --session aiworld-admin find label "Password" fill "$ADMIN_PASSWORD"
agent-browser --session aiworld-admin find role button click --name "Sign in"
agent-browser --session aiworld-admin wait --url "**/admin/**"
agent-browser --session aiworld-admin snapshot -i
agent-browser --session aiworld-admin close
```

The exact labels and route patterns may change during implementation; each UI
plan must update its browser flow to match the implemented accessibility tree.
Use screenshots or recordings as local evidence, not as a replacement for
automated assertions.

## Implementation Record Convention

Every plan contains this section and it must be completed in the same task as
the code implementation:

```md
## Implementation Record

Status: Planned | In Progress | Complete

### Senior-Level Summary

### Files Changed

### Architecture and SOLID Notes

### Tests Run

### Browser Verification

### Known Risks and Follow-Up Work
```

The Senior-Level Summary should explain the resulting design in plain English,
why the chosen boundaries and patterns are justified, and how the capability
connects to the rest of the system.
