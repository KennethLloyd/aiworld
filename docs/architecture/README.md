# Architecture Documentation

These references document the architecture implemented by this starter. They
are intentionally shorter and more durable than the detailed planning notes
and product prototype, which are versioned in this repository.

- [Backend architecture](./backend.md): NestJS modules, repository boundary, Prisma, authentication, shared contracts, and testing.
- [Frontend architecture](./frontend.md): React feature slices, gateway ports, TanStack Query, routing, authentication, and UI boundaries.
- [Product architecture plan](../product/aiworld-architecture-plan.md): overall MVP scope, domain model, simulation design, and build order.
- [MVP prototype](../product/aiworld_mvp.html): visual and interaction reference for the observer and admin experiences.
- [MVP implementation plans](../plans/README.md): dependency-ordered product and engineering plans with test and browser verification records.

The references describe the current World CRUD surface. Future product areas
such as posts, characters, and simulation should extend these boundaries rather
than bypassing them.
