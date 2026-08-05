import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi, authClient, type AuthSession } from '@/core/auth/auth-client';
import { gateways } from '@/providers/gateways-provider';
import { createQueryClient } from '@/providers/query-client';
import { makeSession } from '@/test/fixtures/auth-session';

import {
  guestOnly,
  safeRedirectTarget,
  type GuestOnlyContext,
} from './guest-only';

vi.mock('@/core/auth/auth-client', () => ({
  AuthError: class extends Error {},
  authApi: {
    getSession: vi.fn<() => Promise<AuthSession | null>>(),
    signIn: vi.fn<(email: string, password: string) => Promise<AuthSession>>(),
    signOut: vi.fn<() => Promise<void>>(),
  },
  authClient: {},
}));

function makeContext(
  queryClient: QueryClient,
  redirect?: string,
): GuestOnlyContext {
  return {
    context: { queryClient, gateways, authClient },
    search: { redirect },
  };
}

function resolveRejection(promise: Promise<unknown>): Promise<unknown> {
  return promise.then(
    (value) => value,
    (error) => error,
  );
}

describe('safeRedirectTarget', () => {
  it('accepts internal absolute paths', () => {
    expect(safeRedirectTarget('/admin/worlds')).toBe('/admin/worlds');
  });

  it('rejects protocol-relative and scheme-carrying targets', () => {
    expect(safeRedirectTarget('//evil.example')).toBe('/worlds');
    expect(safeRedirectTarget('/\\evil.example')).toBe('/worlds');
    expect(safeRedirectTarget('https://evil.example')).toBe('/worlds');
    expect(safeRedirectTarget('javascript:alert(1)')).toBe('/worlds');
  });

  it('rejects the sign-in page itself to avoid a redirect loop', () => {
    expect(safeRedirectTarget('/auth/sign-in')).toBe('/worlds');
  });

  it('falls back to /worlds for missing or empty targets', () => {
    expect(safeRedirectTarget(undefined)).toBe('/worlds');
    expect(safeRedirectTarget('')).toBe('/worlds');
  });
});

describe('guestOnly', () => {
  beforeEach(() => {
    vi.mocked(authApi.getSession).mockReset();
  });

  it('lets anonymous visitors through', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);

    const result = await guestOnly(makeContext(createQueryClient()));

    expect(result).toBeUndefined();
  });

  it('redirects signed-in visitors to the validated redirect target', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(makeSession('USER'));

    const error = await resolveRejection(
      guestOnly(makeContext(createQueryClient(), '/admin/worlds')),
    );

    expect(error).toBeInstanceOf(Response);
    const options = (error as Response & { options: Record<string, unknown> })
      .options;
    expect(options.href).toBe('/admin/worlds');
    expect(options.replace).toBe(true);
  });

  it('falls back to /worlds when the redirect target is unsafe', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(makeSession('USER'));

    const error = await resolveRejection(
      guestOnly(makeContext(createQueryClient(), '//evil.example')),
    );

    expect(error).toBeInstanceOf(Response);
    const options = (error as Response & { options: Record<string, unknown> })
      .options;
    expect(options.href).toBe('/worlds');
  });
});
