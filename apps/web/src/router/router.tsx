import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { authClient } from '@/core/auth/auth-client';
import type { Gateways } from '@/core/services/gateways';
import type { WorldGateway } from '@/features/worlds/api/world-gateway';
import { gateways } from '@/providers/gateways-provider';
import { queryClient } from '@/providers/query-client';

import { routeTree } from './routeTree.gen';

export interface RouterContext {
  queryClient: QueryClient;
  gateways: Gateways<WorldGateway>;
  authClient: typeof authClient;
}

export const router = createRouter({
  routeTree,
  context: {
    queryClient,
    gateways,
    authClient,
  },
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
