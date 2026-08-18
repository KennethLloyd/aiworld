import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { sessionKeys } from '@/core/auth/session-keys';
import { createQueryClient } from '@/providers/query-client';
import { renderAuthRoutes } from '@/test/auth-router-harness';
import { makeSession } from '@/test/fixtures/auth-session';

const mbtiWorld: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: { about: 'A world about personality typology.' },
  rules: ['No harassment', 'Stay in character'],
  topicScope: 'Personality types, cognition and communication styles.',
  residentCount: 16,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

let patchRequests: Record<string, unknown>[];
let detailRequests: string[];

const server = setupServer(
  http.get('*/api/worlds/:slug', ({ params }) => {
    const slug = String(params.slug);
    detailRequests.push(slug);
    if (slug === 'missing') {
      return HttpResponse.json(
        { statusCode: 404, message: 'Not Found', error: 'NotFoundException' },
        { status: 404 },
      );
    }
    return HttpResponse.json({ ...mbtiWorld, slug });
  }),
  http.patch('*/api/worlds/:slug', async ({ params, request }) => {
    const slug = String(params.slug);
    const body = (await request.json()) as Record<string, unknown>;
    patchRequests.push(body);
    // A slug edit moves the public URL: echo the requested slug back so the
    // route follows the rename (mirrors the backend update contract).
    const nextSlug = typeof body.slug === 'string' ? body.slug : slug;
    return HttpResponse.json({ ...mbtiWorld, ...body, slug: nextSlug });
  }),
);

/** Focused error-state tests disable retries so 5xx surfaces immediately. */
function retryDisabledClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('/admin/worlds/$slug route', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    patchRequests = [];
    detailRequests = [];
  });
  afterAll(() => server.close());

  it('redirects anonymous visitors to sign-in', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, null);

    const { router } = renderAuthRoutes('/admin/worlds/mbti', {
      queryClient: client,
    });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/auth/sign-in'),
    );
  });

  it('hydrates the edit form from the loaded world', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds/mbti', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Edit MBTI' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('MBTI');
    expect(screen.getByLabelText('Slug')).toHaveValue('mbti');
    expect(screen.getByLabelText('Rule 1')).toHaveValue('No harassment');
    expect(screen.getByLabelText('Rule 2')).toHaveValue('Stay in character');
    expect(screen.getByLabelText('Description key 1')).toHaveValue('about');
    expect(screen.getByLabelText('Description value 1')).toHaveValue(
      'A world about personality typology.',
    );
  });

  it('updates the world and keeps the route on the same slug', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    const { router } = renderAuthRoutes('/admin/worlds/mbti', {
      queryClient: client,
    });

    await screen.findByRole('heading', { name: 'Edit MBTI' });

    const nameInput = screen.getByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'MBTI Revised');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('World updated')).toBeInTheDocument();
    expect(patchRequests).toHaveLength(1);
    expect(patchRequests[0]).toMatchObject({ name: 'MBTI Revised' });
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/worlds/mbti'),
    );
  });

  it('navigates to the new slug when the slug is edited', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    const { router } = renderAuthRoutes('/admin/worlds/mbti', {
      queryClient: client,
    });

    await screen.findByRole('heading', { name: 'Edit MBTI' });

    const slugInput = screen.getByLabelText('Slug');
    await userEvent.clear(slugInput);
    await userEvent.type(slugInput, 'mbti-v2');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('World updated')).toBeInTheDocument();
    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/admin/worlds/mbti-v2'),
    );
  });

  it('renders the not-found visual with a link back to the admin list', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds/missing', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'World not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/missing/)).toBeInTheDocument();

    const backLink = screen.getByRole('link', {
      name: 'Back to admin worlds',
    });
    expect(backLink).toHaveAttribute(
      'href',
      expect.stringContaining('/admin/worlds'),
    );
  });

  it('renders ErrorState with retry for other failures', async () => {
    server.use(
      http.get('*/api/worlds/mbti', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'Error' },
          { status: 500 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(sessionKeys.current, makeSession('ADMIN'));

    renderAuthRoutes('/admin/worlds/mbti', { queryClient: client });

    expect(
      await screen.findByRole('heading', {
        name: 'Could not load this world',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
