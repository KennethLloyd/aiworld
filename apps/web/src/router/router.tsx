import type { QueryClient } from '@tanstack/react-query';
import { createRouter } from '@tanstack/react-router';

import { authClient } from '@/core/auth/auth-client';
import { gateways, type AppGateways } from '@/providers/gateways-provider';
import { queryClient } from '@/providers/query-client';

import { routeTree } from './routeTree.gen';

export interface RouterContext {
  queryClient: QueryClient;
  gateways: AppGateways;
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
