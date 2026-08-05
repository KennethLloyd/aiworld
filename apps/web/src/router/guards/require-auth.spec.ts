import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi, authClient, type AuthSession } from '@/core/auth/auth-client';
import { gateways } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';
import { makeSession } from '@/test/fixtures/auth-session';

import { requireAuth, type GuardContext } from './require-auth';

vi.mock('@/core/auth/auth-client', () => ({
  AuthError: class extends Error {},
  authApi: {
    getSession: vi.fn<() => Promise<AuthSession | null>>(),
    signIn: vi.fn<(email: string, password: string) => Promise<AuthSession>>(),
    signOut: vi.fn<() => Promise<void>>(),
  },
  authClient: {},
}));

function makeContext(href: string, queryClient: QueryClient): GuardContext {
  return {
    context: { queryClient, gateways, authClient },
    location: { href },
  };
}

function resolveRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => value,
    (error) => error,
  );
}

describe('requireAuth', () => {
  beforeEach(() => {
    vi.mocked(authApi.getSession).mockReset();
  });

  it('returns the session for a signed-in visitor', async () => {
    const session = makeSession('ADMIN');
    vi.mocked(authApi.getSession).mockResolvedValue(session);
    const queryClient = createQueryClient();

    const result = await requireAuth(makeContext('/admin/worlds', queryClient));

    expect(result).toEqual({ session });
    expect(authApi.getSession).toHaveBeenCalledTimes(1);
    // The fetched session is cached under the canonical session key.
    expect(queryClient.getQueryData(['session', 'current'])).toEqual(session);
  });

  it('redirects anonymous visitors to sign-in carrying the current href', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    const queryClient = createQueryClient();

    const error = await resolveRejection(
      requireAuth(makeContext('/admin/worlds', queryClient)),
    );

    expect(error).toBeInstanceOf(Response);
    const options = (error as Response & { options: Record<string, unknown> })
      .options;
    expect(options.to).toBe('/auth/sign-in');
    expect(options.search).toEqual({ redirect: '/admin/worlds' });
  });

  it('reuses a fresh cached session without hitting authApi', async () => {
    const session = makeSession('ADMIN');
    const queryClient = createQueryClient();
    queryClient.setQueryData(['session', 'current'], session);

    const result = await requireAuth(makeContext('/admin/worlds', queryClient));

    expect(result).toEqual({ session });
    expect(authApi.getSession).not.toHaveBeenCalled();
  });
});
