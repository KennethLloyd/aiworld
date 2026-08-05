import { redirect } from '@tanstack/react-router';

import type { RouterContext } from '@/router/router';

import { fetchSessionForGuard } from './require-auth';

export interface GuestOnlyContext {
  context: RouterContext;
  search: { redirect?: string | undefined };
}

/**
 * Only internal paths may be used as a post-auth redirect target: the value
 * must start with '/', must not be protocol-relative (// or \\) or carry a
 * URL scheme, and must never be the sign-in page itself (that would create a
 * redirect loop). Anything else falls back to /worlds.
 */
export function safeRedirectTarget(raw: string | undefined): string {
  if (
    typeof raw === 'string' &&
    raw.startsWith('/') &&
    !raw.startsWith('//') &&
    !raw.startsWith('/\\') &&
    !/^[a-z][a-z0-9+.-]*:/i.test(raw) &&
    raw !== '/auth/sign-in'
  ) {
    return raw;
  }
  return '/worlds';
}

/**
 * UX-only guard for auth-only pages (sign-in): authenticated users are sent
 * to the validated `redirect` search target (default /worlds) so the form can
 * never be reached twice.
 */
export async function guestOnly(ctx: GuestOnlyContext) {
  const session = await fetchSessionForGuard(ctx.context);
  if (!session) {
    return;
  }
  throw redirect({
    href: safeRedirectTarget(ctx.search.redirect),
    replace: true,
  });
}
