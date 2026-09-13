import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

const world: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: { about: 'A world of personality typology.' },
  rules: ['Be kind'],
  topicScope: 'Personality types.',
  residentCount: 16,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const narrative = {
  recentEvents: '@readthemanual found a clue, and @leftsnacks wants answers.',
  storySoFar:
    '@readthemanual noticed the missing mug.\n\n@leftsnacks asked where it went, and the question remains open.',
};

const server = setupServer(
  http.get('*/api/worlds/mbti', () => HttpResponse.json(world)),
  http.get('*/api/worlds/mbti/narrative', () => HttpResponse.json(narrative)),
);

describe('public Story So Far route', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders saved chronological prose and the active Story navigation', async () => {
    renderPublicRoutes('/worlds/mbti/story');

    expect(
      await screen.findByRole('heading', { name: 'Story So Far' }),
    ).toBeInTheDocument();
    expect(screen.getByText('@readthemanual')).toBeInTheDocument();
    expect(screen.getByText('@leftsnacks')).toBeInTheDocument();
    const navigation = screen.getByRole('navigation', {
      name: 'Mobile world navigation',
    });
    expect(
      within(navigation).getByRole('link', { name: 'Story' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('shows a retryable state when saved narrative cannot be read', async () => {
    server.use(
      http.get('*/api/worlds/mbti/narrative', () =>
        HttpResponse.json({ message: 'Unavailable' }, { status: 503 }),
      ),
    );
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    renderPublicRoutes('/worlds/mbti/story', { queryClient });

    expect(
      await screen.findByText('Could not load Story So Far'),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(narrative.storySoFar)).not.toBeInTheDocument(),
    );
  });
});
