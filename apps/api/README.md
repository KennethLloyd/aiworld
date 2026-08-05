# @aiworld/api

NestJS 11 REST API for the `nest-react-monorepo-starter` workspace. The API
uses Prisma 7 with PostgreSQL, Better Auth for database-backed sessions, and
shared Zod contracts from `@aiworld/shared`.

The root workspace is orchestrated by Turborepo. Run API-only commands with
`pnpm --filter @aiworld/api <script>`, or run the complete workspace task from
the repository root with `pnpm turbo run <task>`.

## Quick Start

From the repository root:

```bash
pnpm install
cp apps/api/.env.example apps/api/.env
docker compose -f apps/api/docker-compose.yml up -d postgres

pnpm --filter @aiworld/api db:generate
pnpm --filter @aiworld/api db:migrate
pnpm --filter @aiworld/api db:seed
pnpm --filter @aiworld/api dev
```

The server runs at **http://localhost:3000**. The API applies the global
`/api` prefix, so the root endpoint is `GET /api` and World routes are under
`/api/worlds`.

Required environment variables are documented in `.env.example`:

- `DATABASE_URL` points to PostgreSQL.
- `BETTER_AUTH_SECRET` signs Better Auth session data.
- `BETTER_AUTH_URL` is the API's base URL.
- `FRONTEND_ORIGIN` is a comma-separated list of browser origins for
  credentialed CORS and Better Auth trusted origins. It is optional for the
  Vite proxy setup.

## Database And Admin User

The included compose file starts PostgreSQL 17 with the default local database
`aiworld`. The World seed is idempotent and upserts the `mbti` World.

Create or promote a repeatable local ADMIN account after migrations:

```bash
ADMIN_EMAIL=admin@aiworld.local \
ADMIN_PASSWORD='change-this-local-password' \
pnpm --filter @aiworld/api db:seed:admin
```

Optional variables for that script are `ADMIN_NAME` and `ADMIN_USERNAME`.

## HTTP Surface

| Method | Route | Access | Result |
| --- | --- | --- | --- |
| `GET` | `/api` | Public | `Hello World!` |
| `GET` | `/api/worlds` | Public | Paginated World list |
| `GET` | `/api/worlds/:slug` | Public | One World or `404` |
| `POST` | `/api/worlds` | ADMIN | Creates a World |
| `PATCH` | `/api/worlds/:slug` | ADMIN | Updates a World |
| `DELETE` | `/api/worlds/:slug` | ADMIN | Returns `204 No Content` |
| `*` | `/api/auth/*` | Mixed | Better Auth email/password and session endpoints |

World query parameters are `page`, `limit`, `isActive`, and `search`. Page
defaults to `1`, limit defaults to `20`, and limit is capped at `100`.

Request validation is route-scoped with Zod. API errors use the normalized
`{ statusCode, message, error }` envelope; validation errors retain their
Zod issues array. Better Auth responses use Better Auth's own response shape.

OpenAPI documentation is available at **http://localhost:3000/api/docs**.

## Scripts

Run these from the repository root with `pnpm --filter @aiworld/api <script>` or
from this directory with `pnpm <script>`.

| Command | Description |
| --- | --- |
| `pnpm dev` | Start NestJS in watch mode |
| `pnpm build` | Create the production API build |
| `pnpm start:prod` | Run `dist/main.js` |
| `pnpm test` | Run Jest unit tests |
| `pnpm test:e2e` | Run Supertest end-to-end tests |
| `pnpm lint` | Check with oxlint without modifying files |
| `pnpm lint:fix` | Apply oxlint fixes |
| `pnpm format` | Format source files with oxfmt |
| `pnpm format:check` | Verify formatting without changing files |
| `pnpm db:generate` | Generate the Prisma client |
| `pnpm db:migrate` | Create/apply local Prisma migrations |
| `pnpm db:seed` | Upsert the sample MBTI World |
| `pnpm db:seed:admin` | Create or promote an ADMIN from `ADMIN_*` variables |

## Structure

```text
apps/api/
├── src/
│   ├── common/             # Filter, interceptor, and route-scoped Zod pipe
│   ├── lib/                # Better Auth, Prisma, config, and OpenAPI setup
│   ├── world/              # World controller, service, repository, mapper
│   ├── app.module.ts
│   └── main.ts
├── prisma/
│   ├── models/             # Auth and World Prisma models
│   ├── migrations/
│   ├── seed-world.ts
│   └── seed-admin.ts
└── test/                   # API end-to-end tests
```

The World service depends on a repository port, not Prisma. Only the concrete
Prisma repository imports generated Prisma types. Shared request, response, and
pagination contracts live in `packages/shared/` and are consumed through
`workspace:*`.

See the [backend architecture reference](../../docs/architecture/backend.md)
for the full request flow, dependency direction, security boundary, and
testing model.
