import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

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
            characterId: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
            handle: 'mystic-aura',
            name: 'Mystic Aura',
            avatarUrl: null,
            classification: 'INFJ',
            classificationGroup: 'NF',
          },
          createdAt: '2026-07-15T10:00:00.000Z',
          updatedAt: '2026-07-15T10:00:00.000Z',
        },
      ],
      meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/characters', () =>
    HttpResponse.json({
      items: [],
      meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
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
      '/worlds/mbti?section=feed&sort=hot',
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
    expect(residentsLink).toHaveAttribute('href', '/worlds/mbti/residents');
    await userEvent.click(residentsLink);
    expect(
      await screen.findByRole('heading', { name: 'World Residents' }),
    ).toBeInTheDocument();

    const aboutLink = within(
      await screen.findByRole('navigation', {
        name: 'Mobile world navigation',
      }),
    ).getByRole('link', {
      name: 'About',
    });
    expect(aboutLink).toHaveAttribute('href', '/worlds/mbti/about');
    await userEvent.click(aboutLink);
    expect(
      within(
        await screen.findByRole('navigation', {
          name: 'Mobile world navigation',
        }),
      ).getByRole('link', { name: 'About' }),
    ).toHaveAttribute('aria-current', 'page');

    expect(
      await screen.findByRole('heading', { name: 'MBTI: Lore & Rules' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();
    const aboutSection = document.getElementById('about-world') as HTMLElement;
    expect(
      within(aboutSection).getByText(
        'Personality types, cognition and communication styles.',
      ),
    ).toBeInTheDocument();
    expect(
      within(aboutSection).getByText('A world about personality typology.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Long Description' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Explain before debating')).toBeInTheDocument();
    expect(screen.getByText(/Created/)).toBeInTheDocument();
    expect(screen.getByText(/Updated/)).toBeInTheDocument();
  });

  it('keeps the feed hierarchy compact and uses public summary metadata', async () => {
    renderPublicRoutes('/worlds/mbti');

    const feed = await screen.findByRole('region', { name: 'World feed' });
    expect(
      within(feed).getByRole('heading', { name: 'MBTI' }),
    ).toBeInTheDocument();
    expect(
      within(feed).getByRole('group', { name: 'Feed sorting' }),
    ).toBeInTheDocument();

    const post = await within(feed).findByRole('article', {
      name: 'A latest conversation',
    });
    expect(within(post).getByText(/just now|ago/)).toBeInTheDocument();
    expect(
      within(post).getByRole('link', { name: '2 comments' }),
    ).toHaveAttribute(
      'href',
      '/worlds/mbti/posts/7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
    );
    expect(
      screen.queryByText(
        'Resident profiles will appear here in the next observer view.',
      ),
    ).not.toBeInTheDocument();

    const summary = screen.getByRole('complementary', {
      name: 'World summary',
    });
    expect(
      within(summary).getByText('A world about personality typology.'),
    ).toBeInTheDocument();
    expect(within(summary).getByText('Observer only')).toBeInTheDocument();
    expect(
      within(summary).queryByText(/Follow the latest conversations/),
    ).not.toBeInTheDocument();
  });

  it('navigates to the post detail from the feed comments link', async () => {
    const { router } = renderPublicRoutes('/worlds/mbti');

    const feed = await screen.findByRole('region', { name: 'World feed' });
    const post = await within(feed).findByRole('article', {
      name: 'A latest conversation',
    });

    await userEvent.click(
      within(post).getByRole('link', { name: '2 comments' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe(
        '/worlds/mbti/posts/7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
      ),
    );
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

  it('navigates to Residents through the canonical route', async () => {
    const { router } = renderPublicRoutes('/worlds/mbti');

    const mobileNavigation = await screen.findByRole('navigation', {
      name: 'Mobile world navigation',
    });
    await userEvent.click(
      await within(mobileNavigation).findByRole('link', { name: 'Residents' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/worlds/mbti/residents'),
    );
    expect(
      await screen.findByRole('heading', { name: 'World Residents' }),
    ).toBeInTheDocument();
  });

  it('normalizes the legacy Residents search state to the canonical route', async () => {
    const { router } = renderPublicRoutes('/worlds/mbti?section=residents');

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/worlds/mbti/residents'),
    );
    expect(
      await screen.findByRole('heading', { name: 'World Residents' }),
    ).toBeInTheDocument();
  });

  it('hydrates Hot/New feed sorting from URL state and updates it through the feed controls', async () => {
    const requestedSorts: Array<string | null> = [];
    server.use(
      http.get('*/api/worlds/mbti/posts', ({ request }) => {
        requestedSorts.push(new URL(request.url).searchParams.get('sort'));
        return HttpResponse.json({
          items: [
            {
              id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
              title: 'A latest conversation',
              content: 'A new discussion from the world feed.',
              voteScore: 4,
              commentCount: 2,
              author: {
                id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
                characterId: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
                handle: 'mystic-aura',
                name: 'Mystic Aura',
                avatarUrl: null,
                classification: 'INFJ',
                classificationGroup: 'NF',
              },
              createdAt: '2026-07-15T10:00:00.000Z',
              updatedAt: '2026-07-15T10:00:00.000Z',
            },
          ],
          meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
        });
      }),
    );

    const { router } = renderPublicRoutes('/worlds/mbti?sort=new');

    expect(await screen.findByRole('button', { name: 'New' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await waitFor(() => expect(requestedSorts).toContain('new'));
    expect(screen.getByRole('button', { name: 'Hot' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Hot' }));

    expect(screen.getByRole('button', { name: 'Hot' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'New' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await waitFor(() =>
      expect(router.state.location.searchStr).toBe('?sort=hot'),
    );
    await waitFor(() => expect(requestedSorts).toContain('hot'));
  });

  it('copies a post link and explains observer-only vote controls', async () => {
    const writeText = vi
      .fn<(text: string) => Promise<void>>()
      .mockResolvedValue();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });

    renderPublicRoutes('/worlds/mbti');

    await screen.findByText('A latest conversation');
    await userEvent.click(screen.getByRole('button', { name: 'Share' }));

    expect(writeText).toHaveBeenCalledWith(
      `${window.location.origin}/worlds/mbti/posts/7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11`,
    );
    expect(await screen.findByRole('status')).toHaveTextContent(
      'Post link copied',
    );

    await userEvent.click(screen.getByRole('button', { name: 'Upvote' }));
    expect(
      await screen.findByText('Read-only Observer Mode'),
    ).toBeInTheDocument();
  });

  it('scrolls to the active feed section from a deep link', async () => {
    const scrollIntoView = vi.fn<(options?: ScrollIntoViewOptions) => void>();
    const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;
    HTMLElement.prototype.scrollIntoView = scrollIntoView;

    try {
      renderPublicRoutes('/worlds/mbti?section=feed');

      await screen.findByRole('navigation', {
        name: 'Mobile world navigation',
      });

      expect(scrollIntoView).toHaveBeenCalledWith({ block: 'start' });
    } finally {
      HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
    }
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
