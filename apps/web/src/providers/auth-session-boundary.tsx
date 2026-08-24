import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useEffect, type ReactNode } from 'react';

import { sessionKeys } from '@/core/auth/session-keys';

/** Redirects to sign-in after an authenticated request expires. */
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
