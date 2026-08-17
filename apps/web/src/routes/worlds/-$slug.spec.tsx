import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

/** Focused error-state tests disable retries so 5xx surfaces immediately. */
function retryDisabledClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

const mbtiWorld: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: {
    about: 'A world about personality typology.',
    long_description: 'Cognitive functions, dichotomies and development.',
  },
  rules: ['No harassment', 'Stay in character', 'Explain before debating'],
  topicScope: 'Personality types, cognition and communication styles.',
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const server = setupServer(
  http.get('*/api/worlds/mbti', () => HttpResponse.json(mbtiWorld)),
  http.get('*/api/worlds/mbti/posts', () =>
    HttpResponse.json({
      items: [
        {
          id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
          title: 'A latest conversation',
          content: 'A new discussion from the world feed.',
          voteScore: 4,
          commentCount: 2,
          author: {
            id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
            handle: 'mystic-aura',
            name: 'Mystic Aura',
            avatarUrl: null,
          },
          createdAt: '2026-07-15T10:00:00.000Z',
          updatedAt: '2026-07-15T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/worlds/missing', () =>
    HttpResponse.json(
      { statusCode: 404, message: 'Not Found', error: 'NotFoundException' },
      { status: 404 },
    ),
  ),
  http.get('*/api/worlds', () =>
    HttpResponse.json({
      items: [mbtiWorld],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
  ),
);

describe('public world detail route', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    window.history.replaceState(null, '', window.location.pathname);
  });
  afterAll(() => server.close());

  it('renders the world content: name, badge, topic scope, description, rules, dates', async () => {
    renderPublicRoutes('/worlds/mbti');

    expect(await screen.findByTestId('world-layout')).toBeInTheDocument();
    expect(
      screen.getByRole('navigation', { name: 'World navigation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'The Feed' })).toHaveAttribute(
      'href',
      '#feed',
    );
    expect(
      screen.getByRole('navigation', { name: 'Mobile world navigation' }),
    ).toBeInTheDocument();

    const mobileNavigation = await screen.findByRole('navigation', {
      name: 'Mobile world navigation',
    });
    const residentsLink = within(mobileNavigation).getByRole('link', {
      name: 'Residents',
    });
    expect(residentsLink).toHaveAttribute('href', '#residents');
    await userEvent.click(residentsLink);
    expect(residentsLink).toHaveAttribute('aria-current', 'location');
    expect(document.getElementById('residents')).toBeInTheDocument();

    const aboutLink = within(mobileNavigation).getByRole('link', {
      name: 'About',
    });
    expect(aboutLink).toHaveAttribute('href', '#about-world');
    await userEvent.click(aboutLink);
    expect(aboutLink).toHaveAttribute('aria-current', 'location');
    expect(document.getElementById('about-world')).toBeInTheDocument();

    expect(
      await screen.findByRole('heading', { name: 'MBTI' }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Active')).toHaveLength(2);
    expect(
      screen.getByText(
        'Personality types, cognition and communication styles.',
      ),
    ).toBeInTheDocument();
    expect(
      await screen.findByText('A latest conversation'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Mystic Aura avatar' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'About' })).toBeInTheDocument();
    expect(
      screen.getByText('A world about personality typology.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Long Description' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Explain before debating')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('renders the not-found visual with a link back to /worlds for a missing slug', async () => {
    renderPublicRoutes('/worlds/missing');

    expect(
      await screen.findByRole('heading', { name: 'World not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/missing/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('link', { name: 'Back to worlds' }));

    expect(await screen.findByText('MBTI')).toBeInTheDocument();
  });

  it('hydrates the active section from the route search state', async () => {
    renderPublicRoutes('/worlds/mbti?section=residents');

    const mobileNavigation = await screen.findByRole('navigation', {
      name: 'Mobile world navigation',
    });
    expect(
      await within(mobileNavigation).findByRole('link', { name: 'Residents' }),
    ).toHaveAttribute('aria-current', 'location');
  });

  it('renders ErrorState with retry for non-404 errors', async () => {
    server.use(
      http.get('*/api/worlds/mbti', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'Error' },
          { status: 500 },
        ),
      ),
    );

    renderPublicRoutes('/worlds/mbti', { queryClient: retryDisabledClient() });

    expect(
      await screen.findByRole('heading', {
        name: 'Could not load this world',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
