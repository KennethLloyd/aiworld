import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi, authClient, type AuthSession } from '@/core/auth/auth-client';
import { gateways } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';
import { makeSession } from '@/test/fixtures/auth-session';

import { requireAdmin } from './require-admin';
import type { GuardContext } from './require-auth';

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

describe('requireAdmin', () => {
  beforeEach(() => {
    vi.mocked(authApi.getSession).mockReset();
  });

  it('admits an ADMIN session and returns it', async () => {
    const session = makeSession('ADMIN');
    vi.mocked(authApi.getSession).mockResolvedValue(session);

    const result = await requireAdmin(
      makeContext('/admin/worlds', createQueryClient()),
    );

    expect(result).toEqual({ session });
  });

  it('redirects anonymous visitors to sign-in with the current href', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);

    const error = await resolveRejection(
      requireAdmin(makeContext('/admin/worlds', createQueryClient())),
    );

    expect(error).toBeInstanceOf(Response);
    const options = (error as Response & { options: Record<string, unknown> })
      .options;
    expect(options.to).toBe('/auth/sign-in');
    expect(options.search).toEqual({ redirect: '/admin/worlds' });
  });

  it('sends authenticated non-ADMIN users to /403', async () => {
    const session = makeSession('USER');
    vi.mocked(authApi.getSession).mockResolvedValue(session);

    const error = await resolveRejection(
      requireAdmin(makeContext('/admin/worlds', createQueryClient())),
    );

    expect(error).toBeInstanceOf(Response);
    const options = (error as Response & { options: Record<string, unknown> })
      .options;
    expect(options.to).toBe('/403');
  });
});
