import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authApi, AuthError, type AuthSession } from '@/core/auth/auth-client';
import { sessionKeys } from '@/core/auth/session-keys';
import { createQueryClient } from '@/providers/query-client';
import { renderAuthRoutes } from '@/test/auth-router-harness';
import { makeSession } from '@/test/fixtures/auth-session';

vi.mock('@/core/auth/auth-client', () => {
  class MockAuthError extends Error {
    readonly status: number;
    readonly code: string | undefined;

    constructor(message: string, status = 401, code?: string) {
      super(message);
      this.name = 'AuthError';
      this.status = status;
      this.code = code;
    }
  }

  return {
    AuthError: MockAuthError,
    authApi: {
      getSession: vi.fn<() => Promise<AuthSession | null>>(),
      signIn:
        vi.fn<(email: string, password: string) => Promise<AuthSession>>(),
      signOut: vi.fn<() => Promise<void>>(),
    },
    authClient: {},
  };
});

describe('/auth/sign-in route', () => {
  beforeEach(() => {
    vi.mocked(authApi.getSession).mockReset();
    vi.mocked(authApi.signIn).mockReset();
  });

  it('renders the sign-in form for anonymous visitors', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, null);

    renderAuthRoutes('/auth/sign-in', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Sign in' }),
    ).toBeInTheDocument();
    expect(await screen.findByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('signs in, shows a success toast, and navigates to the default target', async () => {
    const session = makeSession('ADMIN');
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    vi.mocked(authApi.signIn).mockResolvedValue(session);
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, null);

    const { router } = renderAuthRoutes('/auth/sign-in', {
      queryClient: client,
    });

    await userEvent.type(
      await screen.findByLabelText('Email'),
      'admin@aiworld.test',
    );
    await userEvent.type(screen.getByLabelText('Password'), 'secret');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Signed in')).toBeInTheDocument();
    await waitFor(() => expect(router.state.location.pathname).toBe('/worlds'));
    expect(authApi.signIn).toHaveBeenCalledWith('admin@aiworld.test', 'secret');
  });

  it('renders the AuthError message inline when sign-in fails', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    vi.mocked(authApi.signIn).mockRejectedValue(
      new AuthError('Invalid email or password', 401),
    );
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, null);

    renderAuthRoutes('/auth/sign-in', { queryClient: client });

    await userEvent.type(await screen.findByLabelText('Email'), 'a@b.test');
    await userEvent.type(screen.getByLabelText('Password'), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid email or password',
    );
  });

  it('redirects authenticated visitors to the validated redirect target', async () => {
    vi.mocked(authApi.getSession).mockResolvedValue(null);
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('USER'));

    const { router } = renderAuthRoutes('/auth/sign-in?redirect=/worlds', {
      queryClient: client,
    });

    await waitFor(() => expect(router.state.location.pathname).toBe('/worlds'));
  });

  it('falls back to /worlds when the redirect search target is unsafe', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('USER'));

    const { router } = renderAuthRoutes(
      '/auth/sign-in?redirect=//evil.example',
      { queryClient: client },
    );

    await waitFor(() => expect(router.state.location.pathname).toBe('/worlds'));
  });
});
