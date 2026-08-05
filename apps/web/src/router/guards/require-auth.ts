import { redirect } from '@tanstack/react-router';

import { authApi } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';
import type { RouterContext } from '@/router/router';

/**
 * Structural beforeLoad context the guards read. TanStack Router's real
 * beforeLoad context is assignable to this narrow shape (context is the
 * RouterContext, location exposes the current href), so the guards stay
 * dependency-free and unit-testable without the router.
 */
export interface GuardContext {
  context: RouterContext;
  location: { href: string };
}

/**
 * Loads the current session into the TanStack Query cache for a route guard.
 * `ensureQueryData` reuses a fresh cache entry (the 60s session staleTime),
 * and a null session is a successful result - it must never trip the
 * AuthSessionBoundary (only an explicit 401 marker does).
 */
export function fetchSessionForGuard(context: RouterContext) {
  return context.queryClient.ensureQueryData({
    queryKey: sessionKeys.current,
    queryFn: () => authApi.getSession(),
    staleTime: 60_000,
  });
}

/**
 * UX-only guard: anonymous visitors are redirected to sign-in carrying the
 * current href so they can return after authenticating. Server-side API
 * enforcement is preserved and no auth state store is added.
 */
export async function requireAuth(ctx: GuardContext) {
  const session = await fetchSessionForGuard(ctx.context);
  if (session) {
    return { session };
  }
  throw redirect({
    to: '/auth/sign-in',
    search: { redirect: ctx.location.href },
  });
}
