import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi, type AuthSession } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';
import { createQueryClient } from '@/providers/query-client';
import { makeSession } from '@/test/fixtures/auth-session';

import { useSession, useSignIn, useSignOut } from './use-session';

vi.mock('@/core/auth/auth-client', () => ({
  AuthError: class extends Error {},
  authApi: {
    getSession: vi.fn<() => Promise<AuthSession | null>>(),
    signIn: vi.fn<(email: string, password: string) => Promise<AuthSession>>(),
    signOut: vi.fn<() => Promise<void>>(),
  },
  authClient: {},
}));

function makeWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}

describe('useSession', () => {
  beforeEach(() => {
    vi.mocked(authApi.getSession).mockReset();
    vi.mocked(authApi.signIn).mockReset();
    vi.mocked(authApi.signOut).mockReset();
  });

  it('fetches the session through authApi and caches it under sessionKeys.current', async () => {
    const session = makeSession('ADMIN');
    vi.mocked(authApi.getSession).mockResolvedValue(session);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useSession(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(session);
    expect(queryClient.getQueryData(sessionKeys.current)).toEqual(session);
    expect(authApi.getSession).toHaveBeenCalledTimes(1);
  });

  it('caches null for an anonymous visitor', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useSession(), {
      wrapper: makeWrapper(queryClient),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBeNull();
    expect(queryClient.getQueryData(sessionKeys.current)).toBeNull();
  });
});

describe('useSignIn', () => {
  it('writes the sign-in session into the cache', async () => {
    const session = makeSession('ADMIN');
    vi.mocked(authApi.signIn).mockResolvedValue(session);
    const queryClient = createQueryClient();

    const { result } = renderHook(() => useSignIn(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate({
        email: 'admin@aiworld.test',
        password: 'secret',
      });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authApi.signIn).toHaveBeenCalledWith('admin@aiworld.test', 'secret');
    expect(queryClient.getQueryData(sessionKeys.current)).toEqual(session);
  });
});

describe('useSignOut', () => {
  it('clears the session cache on sign-out', async () => {
    vi.mocked(authApi.signOut).mockResolvedValue(undefined);
    const queryClient = createQueryClient();
    queryClient.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    const { result } = renderHook(() => useSignOut(), {
      wrapper: makeWrapper(queryClient),
    });

    act(() => {
      result.current.mutate(undefined);
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(authApi.signOut).toHaveBeenCalledOnce();
    expect(queryClient.getQueryData(sessionKeys.current)).toBeNull();
  });
});
