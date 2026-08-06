# nest-react-monorepo-starter

A production-minded pnpm + Turborepo starter for an AIWorld-style application:
a NestJS REST API, a React/Vite web app, and browser-safe Zod contracts shared
between them.

## What Is Included

| Workspace | Package | Purpose |
| --- | --- | --- |
| `apps/api` | `@aiworld/api` | NestJS 11 API with Prisma 7, PostgreSQL, Better Auth, World CRUD, and OpenAPI docs |
| `apps/web` | `@aiworld/web` | React 19/Vite application with public World browsing and ADMIN World management |
| `packages/shared` | `@aiworld/shared` | Shared Zod request, response, and pagination contracts |

The current product surface is intentionally small: World CRUD is implemented,
while characters, posts, comments, votes, simulation, and LLM integrations are
future application work rather than part of this starter.

## Requirements

- Node.js 22 or newer
- pnpm 10
- PostgreSQL 17 or a compatible PostgreSQL deployment
- Docker, if using the included local PostgreSQL compose file

## Quick Start

Install dependencies and configure the API:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
```

Start local PostgreSQL with Docker, then create the schema and seed the sample
World:

```bash
docker compose -f apps/api/docker-compose.yml up -d postgres
pnpm --filter @aiworld/api db:generate
pnpm --filter @aiworld/api db:migrate
pnpm --filter @aiworld/api db:seed
```

Start both workspaces:

```bash
pnpm dev
```

The API is available at **http://localhost:3000** and the web app at
**http://localhost:5173**. Vite proxies `/api/*` to the API during development.

## Turborepo

The root scripts delegate workspace orchestration to the local Turborepo
binary. You can use the shortcuts above or invoke Turbo directly:

```bash
pnpm turbo run dev
pnpm turbo run test
pnpm turbo run build
pnpm turbo run lint
pnpm turbo run format:check
```

Turbo runs each task across the API, web, and shared workspaces according to
`turbo.json`, including task dependencies and build outputs.

To create a local ADMIN account for the protected web routes:

```bash
ADMIN_EMAIL=admin@aiworld.local \
ADMIN_PASSWORD='change-this-local-password' \
pnpm --filter @aiworld/api db:seed:admin
```

For a separately hosted frontend, set `FRONTEND_ORIGIN` in the API environment
and `VITE_API_BASE_URL` in `apps/web/.env.local`. Both values are origins, not
secret credentials. `BETTER_AUTH_SECRET` and `DATABASE_URL` must stay server-side.

## API Surface

All API routes use the `/api` prefix.

| Method | Route | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api` | Public | Health-style Hello World response |
| `GET` | `/api/worlds` | Public | List Worlds with search and page/limit pagination |
| `GET` | `/api/worlds/:slug` | Public | Read one World |
| `POST` | `/api/worlds` | ADMIN | Create a World |
| `PATCH` | `/api/worlds/:slug` | ADMIN | Update a World |
| `DELETE` | `/api/worlds/:slug` | ADMIN | Delete a World |
| `*` | `/api/auth/*` | Mixed | Better Auth email/password and session endpoints |

OpenAPI documentation is served at **http://localhost:3000/api/docs** when the
API is running.

## Workspace Commands

Run these from the repository root:

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API and web development servers through Turborepo |
| `pnpm build` | Build the API and web production artifacts |
| `pnpm test` | Run API Jest and web Vitest unit suites |
| `pnpm lint` | Check all workspaces without modifying files |
| `pnpm format:check` | Verify formatting in API and web workspaces |
| `pnpm --filter @aiworld/api test:e2e` | Run API end-to-end tests |

Package-specific commands and database operations are documented in
`apps/api/README.md` and `apps/web/README.md`.

## Architecture Documentation

The current architecture is documented in:

- [Backend architecture](docs/architecture/backend.md)
- [Frontend architecture](docs/architecture/frontend.md)
- [Architecture index](docs/architecture/README.md)
- [Product architecture plan](docs/product/aiworld-architecture-plan.md)
- [MVP prototype](docs/product/aiworld_mvp.html)
- [MVP implementation plans](docs/plans/README.md)

## Project Tracking

MVP execution is tracked in the public [AIWorld MVP GitHub Project](https://github.com/users/KennethLloyd/projects/1).
It contains one parent issue for each plan, with the detailed implementation
contract remaining in `docs/plans/`. Substantial plans must be broken into
focused child issues before implementation starts. Pull requests should link
the child issue with `Refs #<issue-number>`; use `Closes #<parent-number>` only
when the complete parent plan is finished.

Pull requests and pushes to `main` run the [CI workflow](.github/workflows/ci.yml),
which installs the locked dependencies, generates the Prisma client, checks
formatting, lints, tests, and builds the workspaces. A separate API e2e job
starts a temporary PostgreSQL 17 service, applies migrations, and runs the
end-to-end suite.

## Architecture

- `apps/api` keeps Prisma-generated types behind the World repository adapter and maps API-owned records into shared response contracts at the HTTP boundary.
- `apps/web` uses gateway ports and adapters, TanStack Query for server state, TanStack Router for navigation, and route guards for client-side UX.
- `packages/shared` is the single source of truth for request/response validation and pagination shapes; it has no NestJS, Prisma, Node-only, or DOM dependencies.
- Authentication is Better Auth with database-backed sessions and server-enforced ADMIN roles.

Planning documents and the HTML prototype are versioned in `docs/` so the
architecture, product reference, implementation plans, and code travel
together across machines and can be reviewed from GitHub.
