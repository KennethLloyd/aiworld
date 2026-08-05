import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render } from '@testing-library/react';
import type { ReactNode } from 'react';

import { GatewaysProvider } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';
import { Route as IndexRoute } from '@/routes/index';
import { Route as WorldsIndexRoute } from '@/routes/worlds';
import { Route as WorldDetailRoute } from '@/routes/worlds/$slug';

export interface RenderPublicRoutesOptions {
  /** Override the default app query client (e.g. retry: false in error tests). */
  queryClient?: QueryClient;
}

/**
 * Renders the public routes through a memory-history router so Link/Navigate
 * and route hooks (useSearch/useParams/validateSearch) behave like production.
 * The real GatewaysProvider + HttpWorldGateway are used end to end; tests
 * intercept the network with MSW.
 *
 * File routes carry no id/path until update() wires them (exactly what the
 * generated routeTree does); this harness mirrors that wiring against a plain
 * root route.
 */
export function renderPublicRoutes(
  initialPath: string,
  options: RenderPublicRoutesOptions = {},
) {
  const rootRoute = createRootRoute({
    notFoundComponent: () => <p>Not Found</p>,
  });
  // File routes carry no id/path until update() wires them (exactly what the
  // generated routeTree does); the generated file casts `as any`, and since
  // the lint forbids `any` we cast through unknown instead.
  const indexRoute = IndexRoute.update({
    id: '/',
    path: '/',
    getParentRoute: () => rootRoute,
  } as unknown as Parameters<typeof IndexRoute.update>[0]);
  const worldsRoute = WorldsIndexRoute.update({
    id: '/worlds/',
    path: '/worlds',
    getParentRoute: () => rootRoute,
  } as unknown as Parameters<typeof WorldsIndexRoute.update>[0]);
  const worldDetailRoute = WorldDetailRoute.update({
    id: '/worlds/$slug',
    path: '/worlds/$slug',
    getParentRoute: () => rootRoute,
  } as unknown as Parameters<typeof WorldDetailRoute.update>[0]);
  const routeTree = rootRoute.addChildren({
    index: indexRoute,
    worlds: worldsRoute,
    'worlds/$slug': worldDetailRoute,
  });
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={options.queryClient ?? createQueryClient()}>
        <GatewaysProvider>{children}</GatewaysProvider>
      </QueryClientProvider>
    );
  }

  return render(
    <Wrapper>
      <RouterProvider router={router} />
    </Wrapper>,
  );
}
