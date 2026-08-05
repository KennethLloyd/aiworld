import { MutationCache, QueryCache, QueryClient } from '@tanstack/react-query';

import { ApiError } from '@/core/api/api-error';
import { AuthError } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';

/**
 * The QueryClient never imports the router: redirect navigation on 401 is the
 * AuthSessionBoundary's job (wired at the composition root). The cache
 * handlers below only clear the session cache and set an explicit
 * session-expired marker that the boundary observes.
 */
function isUnauthorized(error: unknown): boolean {
  if (error instanceof ApiError) {
    return error.status === 401;
  }
  if (error instanceof AuthError) {
    return error.status === 401;
  }
  return false;
}

export function createQueryClient(): QueryClient {
  let client: QueryClient | undefined;

  const clearSessionOnUnauthorized = (error: unknown): void => {
    if (!isUnauthorized(error) || client === undefined) {
      return;
    }
    client.setQueryData(sessionKeys.current, null);
    client.setQueryData(sessionKeys.expiredMarker, true);
  };

  client = new QueryClient({
    defaultOptions: {
      queries: {
        // Worlds change rarely; public list/detail refetch after 30s.
        staleTime: 30_000,
        gcTime: 5 * 60_000,
        retry: (failureCount, error) =>
          // Never retry client/validation errors; retry network + 5xx a
          // couple of times.
          error instanceof ApiError && error.status >= 400 && error.status < 500
            ? false
            : failureCount < 2,
        refetchOnWindowFocus: true,
      },
      mutations: { retry: false },
    },
    queryCache: new QueryCache({ onError: clearSessionOnUnauthorized }),
    mutationCache: new MutationCache({
      onError: clearSessionOnUnauthorized,
    }),
  });

  return client;
}

/** App-wide instance shared by the QueryClientProvider and the router context. */
export const queryClient = createQueryClient();
