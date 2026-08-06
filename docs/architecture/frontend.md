<!-- status: reference | last-updated: 2026-08-04 -->

# Frontend Architecture Reference

## High-Level Frontend Architecture

The frontend is organized as a layered, feature-oriented application.

```text
Routes / Screens
      |
Feature Components
      |
TanStack Query Hooks
      |
Feature Gateway Port
      |
HTTP Gateway Adapter
      |
HTTP Client
      |
NestJS API
```

The key rule is:

> UI components describe what the user wants. They do not know how the backend works.

## 1. Application layers

### Routes

Routes handle:

- URL structure
- navigation
- route guards
- search parameters
- selecting the appropriate screen

Examples:

```text
/worlds
/worlds/:slug
/auth/sign-in
/admin/worlds
```

Routes should not contain raw API calls.

### Features

Each business area is a vertical slice:

```text
features/
  worlds/
    api/
    query/
    components/
    forms/

  auth/
    query/
    components/
```

A feature owns its:

- API contract
- gateway
- query hooks
- components
- forms
- feature-specific behavior

This keeps changes localized. Adding a future `posts` feature should mostly mean adding `features/posts`, not modifying the entire application.

### Core

`core` contains infrastructure shared by features:

```text
core/
  api/
  auth/
  config/
  services/
```

Examples:

- HTTP client
- API error handling
- Better Auth client
- environment configuration
- gateway composition

Core should not import business features.

### Shared

`shared` contains reusable presentation-only code:

```text
shared/
  ui/
  layout/
  feedback/
  accessibility/
```

Examples:

- Button
- Modal
- DataTable
- Skeleton
- ErrorState
- AppShell

Shared components should not know about worlds, authentication, or backend APIs.

## 2. Example request flow

When `/worlds` loads:

```text
WorldList route
   |
useWorlds(query)
   |
TanStack Query
   |
WorldGateway.list(query)
   |
HttpWorldGateway
   |
HttpClient.get("/api/worlds")
   |
API response
   |
Zod validation
   |
TanStack Query cache
   |
WorldList renders validated data
```

The important boundary is:

```text
unknown JSON -> Zod schema -> typed application data
```

Invalid backend responses fail immediately instead of contaminating the query cache.

## 3. Dependency direction

Dependencies point inward toward stable abstractions:

```text
Routes
  -> Features
    -> Ports
      -> Adapters
        -> Core infrastructure
```

For example:

```text
WorldList
  -> useWorlds
    -> WorldGateway
      -> HttpWorldGateway
        -> HttpClient
```

The component depends on the `WorldGateway` interface, not on `fetch`.

That allows tests to provide:

```text
FakeWorldGateway
```

instead of requiring a real HTTP server.

## 4. TanStack Query as the server-state layer

TanStack Query owns:

- worlds
- sessions
- loading states
- errors
- caching
- refetching
- mutation status
- invalidation

There is deliberately no Redux or Zustand mirror of backend data.

```text
Server state     -> TanStack Query
Form state       -> React Hook Form
Modal state      -> Component state
URL state        -> TanStack Router
```

This separation prevents multiple competing sources of truth.

## 5. Authentication architecture

The session is treated as query data:

```text
["session", "current"] -> Better Auth getSession()
```

The `AuthProvider` derives convenient values:

```text
session
isSignedIn
isAdmin
```

Route guards provide user experience:

```text
anonymous -> sign-in
USER      -> /403
ADMIN     -> admin screen
```

But the server remains authoritative. The frontend guard is not security; the NestJS role guard is the real security boundary.

## 6. SOLID principles

### Single Responsibility

Each layer has one reason to change:

- HTTP client handles transport
- Gateway handles API mapping
- Query hook handles server-state behavior
- Form handles user input
- Component handles presentation
- Route handles navigation

### Open/Closed

New features are added through new feature slices:

```text
features/posts/
features/characters/
```

Core infrastructure should not need large rewrites.

### Liskov Substitution

A fake gateway should be usable anywhere the real gateway is expected:

```text
WorldGateway
  - HttpWorldGateway
  - FakeWorldGateway
```

Both must honor the same behavior and types.

### Interface Segregation

`WorldGateway` exposes only world operations:

```text
list
getBySlug
create
update
delete
```

Consumers do not depend on a giant application-wide API interface.

### Dependency Inversion

Feature code depends on abstractions:

```text
useWorlds -> WorldGateway
```

The composition root decides which implementation is used:

```text
WorldGateway -> HttpWorldGateway
```

This is the most important senior-level architectural principle in this design.

## 7. Gang of Four patterns

### Adapter

```text
HttpWorldGateway adapts HTTP responses
to the WorldGateway interface.
```

The rest of the application does not know URL or transport details.

### Repository-like Port

The `WorldGateway` acts as a frontend repository boundary. It abstracts access to world data and makes testing easy.

### Factory

The composition root creates the application object graph:

```text
createGateways(apiClient)
createQueryClient()
createRouter()
```

This avoids scattered construction and hidden global dependencies.

### Observer

TanStack Query is an Observer implementation:

```text
Mutation succeeds
   -> cache invalidates
   -> subscribed components update
```

No custom event bus is needed for ordinary data changes.

### Command

Mutation hooks represent user commands:

```text
useCreateWorld
useUpdateWorld
useDeleteWorld
useSignIn
```

They contain execution, success, failure, and cache behavior.

### State

The UI naturally has explicit states:

```text
loading
success
empty
error
forbidden
not found
```

Making these states explicit avoids ambiguous UI behavior.

### Strategy

Strategy should be introduced only when there is real variation.

For example:

```text
WorldGateway
  - HTTP implementation
  - fake implementation
  - future GraphQL implementation
```

Do not create multiple strategies merely because the pattern exists.

## 8. Senior-level tradeoff

This architecture intentionally separates:

```text
business behavior
transport details
server state
UI presentation
navigation
```

The benefit is maintainability and testability.

The cost is more files and more indirection than a simple component with a `fetch` call.

That tradeoff is justified because the application already has:

- authentication
- protected routes
- CRUD mutations
- shared contracts
- multiple UI states
- future feature growth

The senior engineering skill is not using every pattern. It is identifying the boundaries where abstraction protects the system, while rejecting abstraction that has no real purpose.

Detailed planning artifacts are maintained in `docs/plans/` and the product
architecture reference in `docs/product/`. This document is intentionally
high-level and serves as the frontend architecture documentation for the
current implementation.
