import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

import { sessionKeys } from '@/core/auth/session-keys';

/**
 * Composition-root navigation adapter for session expiry (architecture plan
 * 6.6). The QueryClient never imports the router; on a 401 it only clears the
 * session cache and sets the session-expired marker. This boundary observes
 * that marker and redirects to the sign-in route (Phase D), preserving the
 * current path in the `redirect` search param. It never navigates merely
 * because an initial anonymous session query returned null.
 */
export function AuthSessionBoundary({ children }: { children?: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { data: expired } = useQuery({
    queryKey: sessionKeys.expiredMarker,
    queryFn: async () => false,
    enabled: false,
  });

  useEffect(() => {
    if (expired !== true) {
      return;
    }
    queryClient.setQueryData(sessionKeys.expiredMarker, false);
    const redirect = router.state.location.href;
    void router.navigate({
      href: `/auth/sign-in?redirect=${encodeURIComponent(redirect)}`,
    });
  }, [expired, queryClient, router]);

  return <>{children}</>;
}
