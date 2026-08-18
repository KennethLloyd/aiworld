import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { sessionKeys } from '@/core/auth/session-keys';
import { createQueryClient } from '@/providers/query-client';
import { renderAuthRoutes } from '@/test/auth-router-harness';
import { makeSession } from '@/test/fixtures/auth-session';

const createdWorld: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: null,
  rules: ['Stay in character'],
  topicScope: 'Personality types, cognition and communication styles.',
  residentCount: 16,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

let createRequests: Record<string, unknown>[];

const server = setupServer(
  http.post('*/api/worlds', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    createRequests.push(body);
    return HttpResponse.json(createdWorld, { status: 201 });
  }),
  http.get('*/api/worlds', () =>
    HttpResponse.json({
      items: [createdWorld],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
  ),
);

describe('/admin/worlds/new route', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    createRequests = [];
  });
  afterAll(() => server.close());

  it('redirects anonymous visitors to sign-in', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, null);

    const { router } = renderAuthRoutes('/admin/worlds/new', {
      queryClient: client,
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/auth/sign-in'),
    );
  });

  it('renders the create form with blank defaults', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds/new', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'New world' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('');
    expect(screen.getByLabelText('Slug')).toHaveValue('');
    expect(screen.getByLabelText('Rule 1')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'Create world' })).toBeEnabled();
  });

  it('creates the world, shows a toast, and returns to the admin list', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    const { router } = renderAuthRoutes('/admin/worlds/new', {
      queryClient: client,
    });

    await screen.findByRole('heading', { name: 'New world' });

    await userEvent.type(screen.getByLabelText('Name'), 'MBTI');
    await userEvent.type(screen.getByLabelText('Slug'), 'mbti');
    await userEvent.type(
      screen.getByLabelText('Topic scope'),
      'Personality types, cognition and communication styles.',
    );
    await userEvent.type(screen.getByLabelText('Rule 1'), 'Stay in character');
    await userEvent.click(screen.getByRole('button', { name: 'Create world' }));

    expect(await screen.findByText('World saved')).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/worlds'),
    );
    expect(createRequests).toHaveLength(1);
    expect(createRequests[0]).toEqual({
      name: 'MBTI',
      slug: 'mbti',
      topicScope: 'Personality types, cognition and communication styles.',
      rules: ['Stay in character'],
      isActive: true,
      description: null,
    });
  });
});
