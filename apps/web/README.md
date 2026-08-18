# @aiworld/web

The AIWorld browser application, built with React 19, Vite, TanStack Router, TanStack Query, and Tailwind CSS. It consumes the NestJS API through the browser-safe contracts in `@aiworld/shared`.

The root workspace uses Turborepo for build, lint, format, test, and development
tasks. The web dev task runs alongside the API through Turbo's runtime task
relationship, then waits for `http://localhost:3000/api/docs` before starting
Vite so initial requests do not race API startup.

## Quick Start

From the repository root, install dependencies and start both services with
Turborepo:

```bash
pnpm install
pnpm dev
```

Open **http://localhost:5173**. The web task waits for the API OpenAPI
endpoint before starting Vite.

For isolated web development, start the API in a separate terminal first:

```bash
pnpm --filter @aiworld/api dev
pnpm --filter @aiworld/web dev
```

For a separately hosted API, set `VITE_API_BASE_URL` in `apps/web/.env.local`.
This value is public client configuration; never put secrets in `VITE_*`
variables.

## Routes

| Route | Purpose |
| --- | --- |
| `/worlds` | Public active World directory with search and pagination |
| `/worlds/:slug` | Public World detail |
| `/auth/sign-in` | Better Auth email/password sign-in |
| `/admin/worlds` | ADMIN-only World management |
| `/admin/worlds/new` | ADMIN-only World creation |
| `/admin/worlds/:slug` | ADMIN-only World editing |

The API remains the security boundary. Client route guards improve navigation
but do not replace server-side role enforcement.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start the Vite development server |
| `pnpm build` | Typecheck and create the production bundle |
| `pnpm preview` | Serve the production bundle locally |
| `pnpm test` | Run Vitest tests |
| `pnpm test:watch` | Run Vitest in watch mode |
| `pnpm lint` | Check with oxlint |
| `pnpm lint:fix` | Apply oxlint fixes |
| `pnpm format` | Format source files with oxfmt |
| `pnpm format:check` | Verify formatting without changing files |

## Architecture

- `core/` owns HTTP, auth, environment, and composition-root infrastructure.
- `features/` owns World and auth API ports, adapters, queries, forms, and UI.
- `routes/` owns navigation and route guards.
- `shared/` contains presentation-only UI, layout, feedback, and accessibility primitives.
- Every API response is parsed with a shared Zod contract in the gateway adapter before entering the TanStack Query cache.
- Server state belongs to TanStack Query; form state belongs to React Hook Form; URL state belongs to TanStack Router.

The frontend consumes raw TypeScript from `@aiworld/shared` through the
workspace dependency and Vite/TypeScript aliases. No frontend schema mirror is
needed.

See the [frontend architecture reference](../../docs/architecture/frontend.md)
for the feature-slice, gateway, query, routing, and authentication boundaries.
