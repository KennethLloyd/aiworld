import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { authClient } from '@/core/auth/auth-client';
import { gateways, GatewaysProvider } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';
import { Route as AdminIndexRoute } from '@/routes/admin/index';
import { Route as AdminRoute } from '@/routes/admin/route';
import { Route as AdminWorldsRoute } from '@/routes/admin/worlds';
import { Route as AdminWorldsSlugRoute } from '@/routes/admin/worlds.$slug';
import { Route as AdminWorldsNewRoute } from '@/routes/admin/worlds.new';
import { Route as AuthSignInRoute } from '@/routes/auth/sign-in';
import { Toaster } from '@/shared/feedback/toaster';

export interface RenderAuthRoutesOptions {
  /** Override the default app query client (e.g. seeded session cache). */
  queryClient?: QueryClient;
}

/**
 * Renders the admin routes (/admin -> /admin/worlds -> new/$slug) plus the
 * /auth/sign-in route through a memory-history router so beforeLoad guards
 * (requireAdmin/guestOnly), validateSearch, Link/Navigate and route hooks
 * behave like production.
 *
 * Guards call `queryClient.ensureQueryData(sessionKeys.current, ...)`, so a
 * test seeds the session cache (e.g. setQueryData(sessionKeys.current, null)
 * for anonymous or an AuthSession fixture for a signed-in user) before
 * rendering - a fresh cache entry is reused and no network fires.
 *
 * The real GatewaysProvider + HttpWorldGateway are used end to end; worlds
 * API tests intercept the network with MSW. The Toaster host is mounted
 * because admin routes call useToast().
 */
export function renderAuthRoutes(
  initialPath: string,
  options: RenderAuthRoutesOptions = {},
) {
  const client = options.queryClient ?? createQueryClient();
  const rootRoute = createRootRoute({
    notFoundComponent: () => <p>Not Found</p>,
  });
  // File routes carry no id/path until update() wires them (exactly what the
  // generated routeTree does); the generated file casts `as any`, and since
  // the lint forbids `any` we cast through unknown instead.
  const adminRoute = AdminRoute.update({
    id: '/admin',
    path: '/admin',
    getParentRoute: () => rootRoute,
  } as unknown as Parameters<typeof AdminRoute.update>[0]);
  const adminIndexRoute = AdminIndexRoute.update({
    id: '/',
    path: '/',
    getParentRoute: () => adminRoute,
  } as unknown as Parameters<typeof AdminIndexRoute.update>[0]);
  const adminWorldsRoute = AdminWorldsRoute.update({
    id: '/worlds',
    path: '/worlds',
    getParentRoute: () => adminRoute,
  } as unknown as Parameters<typeof AdminWorldsRoute.update>[0]);
  const adminWorldsSlugRoute = AdminWorldsSlugRoute.update({
    id: '/$slug',
    path: '/$slug',
    getParentRoute: () => adminWorldsRoute,
  } as unknown as Parameters<typeof AdminWorldsSlugRoute.update>[0]);
  const adminWorldsNewRoute = AdminWorldsNewRoute.update({
    id: '/new',
    path: '/new',
    getParentRoute: () => adminWorldsRoute,
  } as unknown as Parameters<typeof AdminWorldsNewRoute.update>[0]);
  const signInRoute = AuthSignInRoute.update({
    id: '/auth/sign-in',
    path: '/auth/sign-in',
    getParentRoute: () => rootRoute,
  } as unknown as Parameters<typeof AuthSignInRoute.update>[0]);

  const adminWorlds = adminWorldsRoute.addChildren({
    $slug: adminWorldsSlugRoute,
    new: adminWorldsNewRoute,
  });
  const admin = adminRoute.addChildren({
    index: adminIndexRoute,
    worlds: adminWorlds,
  });
  // Landing stub for post-auth redirect targets (/worlds), which are not part
  // of the admin surface under test but must resolve when guards navigate.
  const worldsStubRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/worlds',
    component: WorldsStub,
  });
  const routeTree = rootRoute.addChildren({
    admin,
    signIn: signInRoute,
    worlds: worldsStubRoute,
  });

  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
    context: {
      queryClient: client,
      gateways,
      authClient,
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={client}>
        <GatewaysProvider>
          <Toaster>{children}</Toaster>
        </GatewaysProvider>
      </QueryClientProvider>
    );
  }

  return {
    ...render(
      <Wrapper>
        <RouterProvider router={router} />
      </Wrapper>,
    ),
    router,
    queryClient: client,
  };
}

function WorldsStub() {
  return <p>Worlds list stub</p>;
}
