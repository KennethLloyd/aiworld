import { redirect } from '@tanstack/react-router';

import { fetchSessionForGuard, type GuardContext } from './require-auth';

/**
 * UX-only admin guard: anonymous visitors go to sign-in (with the current
 * href as the redirect target), authenticated non-ADMIN users go to the
 * canonical /403 route. Guards never substitute for the server-side @Roles
 * enforcement on the write endpoints.
 */
export async function requireAdmin(ctx: GuardContext) {
  const session = await fetchSessionForGuard(ctx.context);
  if (!session) {
    throw redirect({
      to: '/auth/sign-in',
      search: { redirect: ctx.location.href },
    });
  }
  if (session.user.role !== 'ADMIN') {
    throw redirect({ to: '/403' });
  }
  return { session };
}
