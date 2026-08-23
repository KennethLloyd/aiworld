import type { PostDetailResponse } from '@aiworld/shared/schemas/post-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

const postId = '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11';
const authorId = '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12';
const otherAuthorId = '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13';

const author = {
  id: authorId,
  characterId: authorId,
  handle: 'mystic-aura',
  name: 'Mystic Aura',
  avatarUrl: null,
  classification: 'INFJ',
  classificationGroup: 'NF',
} as const;

const otherAuthor = {
  id: otherAuthorId,
  handle: 'calm-voice',
  name: 'Calm Voice',
  avatarUrl: null,
} as const;

const detail: PostDetailResponse = {
  id: postId,
  title: 'A detail conversation',
  content: 'A post with a bounded threaded response.',
  voteScore: 7,
  author,
  comments: [
    {
      id: 'aa3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f14',
      author: {
        ...author,
        name: 'Mystic Aura in the thread',
      },
      content: 'The original poster clarifies the question.',
      voteScore: 3,
      createdAt: '2026-07-15T10:01:00.000Z',
      updatedAt: '2026-07-15T10:01:00.000Z',
      replies: [
        {
          id: 'ba3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f15',
          author: otherAuthor,
          content: 'A thoughtful reply.',
          voteScore: 2,
          createdAt: '2026-07-15T10:02:00.000Z',
          updatedAt: '2026-07-15T10:02:00.000Z',
          replies: [
            {
              id: 'ca3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f16',
              author,
              content: 'The original poster replies again.',
              voteScore: 1,
              createdAt: '2026-07-15T10:03:00.000Z',
              updatedAt: '2026-07-15T10:03:00.000Z',
              replies: [],
            },
          ],
        },
      ],
    },
  ],
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const world: WorldResponse = {
  id: 'da3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f17',
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

const server = setupServer(
  http.get(`*/api/worlds/mbti/posts/${postId}`, () =>
    HttpResponse.json(detail),
  ),
  http.get('*/api/worlds/mbti', () => HttpResponse.json(world)),
  http.get('*/api/worlds/mbti/posts', () =>
    HttpResponse.json({
      items: [
        {
          ...detail,
          commentCount: 3,
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    }),
  ),
);

describe('public post detail route', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    window.history.replaceState(null, '', window.location.pathname);
  });
  afterAll(() => server.close());

  it('renders the post and recursively styles the bounded comment tree', async () => {
    renderPublicRoutes(`/worlds/mbti/posts/${postId}`);

    expect(
      await screen.findByRole('heading', { name: 'A detail conversation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A post with a bounded threaded response.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Comments (3)' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The original poster clarifies the question.'),
    ).toBeInTheDocument();
    expect(screen.getByText('A thoughtful reply.')).toBeInTheDocument();
    expect(
      screen.getByText('The original poster replies again.'),
    ).toBeInTheDocument();

    const nodes = screen.getAllByTestId('comment-node');
    expect(nodes.map((node) => node.getAttribute('data-depth'))).toEqual([
      '0',
      '1',
      '2',
    ]);
    expect(screen.getAllByText('OP')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Mystic Aura' })).toHaveLength(
      2,
    );
    expect(
      screen.getAllByRole('link', { name: 'Mystic Aura' })[0],
    ).toHaveAttribute(
      'href',
      '/worlds/mbti/residents/8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    );
    expect(
      screen.getByRole('link', { name: 'Mystic Aura in the thread' }),
    ).toHaveAttribute(
      'href',
      '/worlds/mbti/residents/8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    );
    expect(screen.getByText('Calm Voice').closest('a')).toBeNull();
    expect(
      screen.getByRole('navigation', { name: 'Mobile world navigation' }),
    ).toBeInTheDocument();
  });

  it('gives disabled observer controls accessible feedback', async () => {
    renderPublicRoutes(`/worlds/mbti/posts/${postId}`);
    await screen.findByRole('heading', { name: 'A detail conversation' });

    const upvote = screen.getByRole('button', { name: 'Upvote post' });
    expect(upvote).toHaveAttribute('aria-disabled', 'true');
    expect(upvote).toHaveAttribute(
      'aria-describedby',
      'observer-mode-description',
    );
    expect(screen.getAllByRole('button', { name: 'Reply' })[0]).toHaveAttribute(
      'aria-describedby',
      'observer-mode-description',
    );
    expect(screen.getByRole('textbox', { name: 'Comment' })).toBeDisabled();
    expect(screen.getByRole('textbox', { name: 'Comment' })).toHaveAttribute(
      'aria-describedby',
      'observer-mode-description',
    );
    expect(screen.getByRole('button', { name: 'Comment' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Comment' })).toHaveAttribute(
      'aria-describedby',
      'observer-mode-description',
    );

    expect(upvote).toBeDisabled();
    expect(
      screen.getByText(/Observers can follow the simulation/),
    ).toBeInTheDocument();
  });

  it('returns to the world feed from a direct post-detail visit', async () => {
    renderPublicRoutes(`/worlds/mbti/posts/${postId}`, {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    });
    await screen.findByRole('heading', { name: 'A detail conversation' });

    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    await waitFor(() => {
      const feed = screen.getByRole('region', { name: 'World feed' });
      expect(
        within(feed).getByRole('heading', { name: 'MBTI' }),
      ).toBeInTheDocument();
    });
    expect(
      await screen.findByText('A detail conversation'),
    ).toBeInTheDocument();
  });

  it('renders a not-found state for an unknown post', async () => {
    const missingPostId = '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f18';
    server.use(
      http.get(`*/api/worlds/mbti/posts/${missingPostId}`, () =>
        HttpResponse.json(
          { statusCode: 404, message: 'Not Found', error: 'NotFoundException' },
          { status: 404 },
        ),
      ),
    );

    renderPublicRoutes(`/worlds/mbti/posts/${missingPostId}`, {
      queryClient: new QueryClient({
        defaultOptions: { queries: { retry: false } },
      }),
    });

    expect(
      await screen.findByRole('heading', { name: 'Post not found' }),
    ).toBeInTheDocument();
  });
});
