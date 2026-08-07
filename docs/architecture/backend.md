<!-- status: reference | last-updated: 2026-08-04 -->

# Backend Architecture Reference

## High-Level Backend Architecture

The backend is a layered NestJS 11 application organized as feature modules behind a strict persistence boundary. It runs in a pnpm + Turborepo monorepo with PostgreSQL, Prisma 7, BetterAuth, and Zod. The API exposes a REST surface under a global `/api` prefix.

```text
HTTP request
      |
Controller (transport) + route-scoped ZodValidationPipe
      |
Service (domain orchestration)
      |
Repository port (abstract class, Nest DI token)
      |
Prisma repository adapter
      |
PrismaService (PrismaClient + PrismaPg)
      |
PostgreSQL
      |
WorldRecord returns up the chain
      |
WorldResponseMapper (HTTP boundary)
      |
shared Zod response contract on the wire
```

The key boundary rule is:

> Controllers shape transport, services coordinate domain behavior, and only the concrete Prisma repository touches generated Prisma types. Persistence types never cross the wire.

## 1. Application layers

### Controllers

Controllers are the HTTP boundary. They declare routes, apply route-scoped validation pipes, bind auth metadata, delegate to services, and map results into shared transport contracts. They contain no persistence logic.

`main.ts` applies `app.setGlobalPrefix('api')`, so the external surface is `/api/worlds`, `/api/worlds/:slug`, and `/api/auth/*`.

### Features

A feature is a vertical slice that owns its controller, service, domain record, mapper, and repository files, all packaged in one NestJS module. `WorldModule` is the canonical example. `WorldService` is deliberately thin: it normalizes the query (trimmed search, default `isActive`), then delegates each operation to the repository port. It knows nothing about Prisma.

### Core / common infrastructure

`common/` holds framework-only concerns shared by every feature: the exception filter (normalized error envelope), the logging interceptor, and the route-scoped `ZodValidationPipe`. `lib/` holds infrastructure: the global `PrismaModule` with `PrismaService` (the only Prisma client) and `auth.ts` (the BetterAuth configuration).

### Shared contracts

`packages/shared` is the single source of truth for request, response, and pagination Zod schemas. The API imports contracts from the shared package, so there is exactly one copy of every wire shape.

## 2. Example request flow

### GET /api/worlds (public read)

```text
GET /api/worlds?page=1&limit=20
   |
WorldController.list
   |  ZodValidationPipe(listWorldsQuerySchema)  <-- handler boundary
   |  coerces "1" and "20" to numbers, applies defaults
   v
WorldService.list(query, isAdmin)      (trims search, forces active-only for public callers)
   |
WorldRepository.findAll(query)        (port, abstract class DI token)
   |
PrismaWorldRepository.findAll         (adapter)
   |
PrismaService.world.findMany + count  (parallel queries)
   |
PostgreSQL
   |
Paginated<WorldRecord> returns up the chain (Date objects intact)
   |
WorldResponseMapper.mapToPaginatedWorldResponse
   |  createdAt / updatedAt -> ISO strings
   v
ListWorldsResponse transport contract serialized to JSON
```

### Admin mutations (briefly)

`POST /api/worlds` runs the same spine with two extra steps: the global auth/role guard rejects anonymous requests (401) and non-ADMIN sessions (403) before the handler, and the body pipe validates against `createWorldSchema`. Success returns 201 with a `WorldResponse`.

## 3. Dependency direction

Dependencies point inward, toward stable abstractions:

```text
WorldController
   -> WorldService
      -> WorldRepository (abstract class, DI token / port)
         -> PrismaWorldRepository (adapter)
            -> PrismaService
               -> PostgreSQL

on the way out:
WorldRecord -> WorldResponseMapper -> WorldResponse (shared contract)
```

The persistence boundary is the repository port.

> `WorldService` depends only on `WorldRepository`, never on `PrismaService` or any generated Prisma type. Generated Prisma types belong only in the concrete `PrismaWorldRepository`; everything above it works with `WorldRecord`.

`WorldRepository` is an abstract class rather than a TypeScript interface because NestJS resolves providers by class token. The module binds the implementation through the same token - `{ provide: WorldRepository, useClass: PrismaWorldRepository }` - so any implementation that extends the port is substitutable through the same token.

## 4. Shared contracts and validation

`packages/shared` owns everything that crosses the wire:

- request schemas: `createWorldSchema`, `updateWorldSchema`, `listWorldsQuerySchema`
- response schemas: `worldResponseSchema`, `listWorldsResponseSchema`
- pagination: `paginationMetaSchema` and the generic `Paginated<T>` type
- inferred TypeScript types via `z.infer`

Validation is per route, never global. The `ZodValidationPipe` is instantiated inline with its schema, for example `@Body(new ZodValidationPipe(createWorldSchema))`. Invalid input becomes a 400 with the Zod issues array and `error: "Validation Failed"`.

Query values arrive as strings, so `page` and `limit` use `z.coerce.number()` with `.default()` values to keep the query fully populated. Errors are normalized by the global `HttpExceptionFilter` into a stable envelope - `{ statusCode, message, error }` - with validation failures passing their Zod issues through as `message`.

There is no global validation pipe and no class-validator DTO mirror anywhere in the codebase.

## 5. Authentication and cross-cutting concerns

Authentication is BetterAuth integrated through the `@thallesp/nestjs-better-auth` community adapter. `AppModule` configures it asynchronously, building the BetterAuth instance with a Prisma adapter over the same `PrismaService`, email/password enabled, and `additionalFields` for `username` (required, unique), `role` (default `'USER'`, not settable at sign-up), and `isDeleted`. Sessions are stored in the database.

The adapter registers a global auth guard, and route metadata decides access:

- `@AllowAnonymous()` - public, no session required (world reads, `GET /api`)
- `@Roles(['ADMIN'])` - authenticated AND role-restricted (world mutations)
- no annotation - authenticated session required (the guard default)

The guard is the real security boundary. Client-side guards are user experience; the server role guard is authority. Because sessions are DB-backed, the server decides.

BetterAuth's own endpoints live under `/api/auth/*` (sign-in, session, sign-out).

Other cross-cutting concerns:

- Global `ThrottlerGuard` via `ThrottlerModule` (100 requests per minute per client).
- Global `HttpExceptionFilter` - normalizes errors into `{ statusCode, message, error }`, keeps validation envelopes intact, and returns a safe generic 500 for unexpected errors (which it also logs).
- Global `LoggingInterceptor` - logs `METHOD url -> status +Nms`.
- `helmet()` in `main.ts`; `bodyParser: false` on the Nest application so BetterAuth can consume raw auth request bodies itself.

## 6. SOLID principles

### Single Responsibility

Each layer has one reason to change: controller (transport, metadata, mapping), service (domain coordination), repository (persistence mechanics), mapper (shape conversion), pipe (validation). `WorldService` is a thin coordinator, not a god class.

### Open/Closed

New behavior arrives as new classes, not edits to existing ones. A new persistence engine is a new repository implementation behind the existing port; services and controllers are untouched.

### Liskov Substitution

Any implementation of `WorldRepository` is usable wherever the port is expected. Unit tests inject a mocked repository through the real DI token; the real `PrismaWorldRepository` is bound only at runtime.

### Interface Segregation

`WorldRepository` exposes only what `WorldService` needs - five methods - not the hundreds of queries a raw Prisma client offers.

### Dependency Inversion

`WorldService` depends on the abstract `WorldRepository`, not on Prisma. The Nest DI container is the composition root - it binds the port to the adapter - and generated Prisma types stay inside the adapter.

## 7. Patterns used

### Repository (port)

```text
WorldRepository (abstract class / DI token)
   - PrismaWorldRepository (adapter)
```

Services depend on the port; persistence is an implementation detail.

### Adapter / Mapper

Two adapters exist at the boundaries. `PrismaWorldRepository` adapts generated Prisma models into `WorldRecord` domain records. `WorldResponseMapper` adapts `WorldRecord` (Dates) into shared `WorldResponse` contracts (ISO strings) so persistence types never leak onto the wire.

### Dependency Injection / composition root

NestJS DI builds the object graph from module metadata - `{ provide: WorldRepository, useClass: PrismaWorldRepository }` and the auth module's `useFactory`. No scattered construction.

### Framework extension points

The global `LoggingInterceptor` and `HttpExceptionFilter` are registered through `APP_INTERCEPTOR` and `APP_FILTER`, so cross-cutting behavior attaches to every request without touching controllers.

> Patterns earn their place only at real boundaries - the repository port, the response mapper, the shared contracts, and framework extension points. Do not add patterns ceremonially: a plain service with no second variant and no cross-boundary type change needs no pattern.

## 8. Testing architecture

Testing is split between Jest unit tests (`src/**/*.spec.ts`) and e2e tests (`test/*.e2e-spec.ts`).

Unit tests build a `TestingModule` and override dependencies with `useValue` mocks:

- `world.service.spec.ts` overrides `WorldRepository` with a mocked fake injected through the real DI token, exercising the port directly.
- `world.controller.spec.ts` overrides `WorldService` and `WorldResponseMapper`, then verifies delegation, not-found paths, and `@Roles` metadata.
- `world-response.mapper.spec.ts` verifies the `Date` to ISO-string conversion.
- Pipe, filter, and interceptor specs verify the validation envelope, the normalized error shape, and the log line.

E2e tests compile the full `AppModule`, override `PrismaService` with a stub exposing only the `world.*` methods the repository uses, and flip a mock auth session between anonymous, USER, and ADMIN:

- `app.e2e-spec.ts` - `GET /api` returns 200; `world.e2e-spec.ts` - exercises the auth boundary (anonymous write -> 401, USER session -> 403), validation (invalid input -> 400 with Zod issues and "Validation Failed"), CRUD (list, get, create, update, delete), and the normalized 404 envelope.

Standing conventions:

> Never `jest.mock` the module under test - inject mocks through the NestJS testing module instead. Never use `as never`. Use the `withEnv` helper to set environment variables. Use real config for static config.

## 9. Senior-level tradeoff

The architecture buys testability, substitutable persistence, one source of truth for contracts, and clear boundaries at the cost of more files and more indirection than a controller that calls `PrismaService` directly.

Two tradeoffs are accepted today:

- Logging is plain `console.log`/`console.error` through the interceptor and filter, not a structured logger - adequate at current scale, replaceable without touching domain code.
- Pagination is offset-based (`page`/`limit`/`total`/`totalPages`) via the shared `Paginated<T>` contract - correct and simple for this CRUD.

The senior skill is not using every pattern. It is recognizing the boundaries where abstraction protects the system - the repository port, the response mapper, the shared contracts - while rejecting abstraction that has no real purpose.

Detailed planning artifacts are maintained in `docs/plans/` and the product
architecture reference in `docs/product/`. This document is intentionally
high-level and serves as the backend architecture documentation for the
current implementation.
