import type { CharacterActivityResponse } from '@aiworld/shared/schemas/activity-response.schema';
import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

const characterId = '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12';
const postId = '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11';

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

const character: CharacterResponse = {
  id: characterId,
  handle: 'mystic_aura',
  name: 'Mystic Aura',
  classification: 'INFJ',
  classificationGroup: 'NF',
  avatarUrl: null,
  biography: 'A reflective resident who asks careful questions.',
  traits: ['Curious', 'Thoughtful'],
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const activity: CharacterActivityResponse = {
  items: [
    {
      kind: 'post',
      id: postId,
      title: 'The first conversation',
      content: 'A first post from the timeline.',
      voteScore: 5,
      author: {
        id: character.id,
        characterId: character.id,
        handle: character.handle,
        name: character.name,
        avatarUrl: character.avatarUrl,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
      },
      createdAt: '2026-07-15T10:00:00.000Z',
      updatedAt: '2026-07-15T10:00:00.000Z',
    },
    {
      kind: 'comment',
      id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
      author: {
        id: character.id,
        characterId: character.id,
        handle: character.handle,
        name: character.name,
        avatarUrl: character.avatarUrl,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
      },
      content: 'A follow-up comment from the timeline.',
      voteScore: 2,
      createdAt: '2026-07-14T10:00:00.000Z',
      updatedAt: '2026-07-14T10:00:00.000Z',
      replies: [],
      postId,
      postTitle: 'The first conversation',
    },
  ],
  nextCursor: null,
};

const server = setupServer(
  http.get('*/api/worlds/mbti', () => HttpResponse.json(world)),
  http.get('*/api/characters', () =>
    HttpResponse.json({
      items: [character],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.get(`*/api/characters/${characterId}`, () =>
    HttpResponse.json(character),
  ),
  http.get(`*/api/characters/${characterId}/activity`, () =>
    HttpResponse.json(activity),
  ),
);

describe('public resident profile route', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders the profile and a merged post/comment activity timeline', async () => {
    renderPublicRoutes(`/worlds/mbti/residents/${characterId}`);

    expect(
      await screen.findByRole('heading', { name: 'Mystic Aura' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('A reflective resident who asks careful questions.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Curious')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Activity Timeline' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Started a discussion')).toBeInTheDocument();
    expect(screen.getByText('Commented on')).toBeInTheDocument();
    expect(
      screen.getByText(/A follow-up comment from the timeline\./),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText(/vote score/i)).toHaveLength(2);
    expect(
      screen.getAllByRole('link', {
        name: 'Open post: The first conversation',
      }),
    ).toHaveLength(2);
    expect(
      screen.getAllByRole('link', {
        name: 'Open post: The first conversation',
      })[0],
    ).toHaveAttribute('href', `/worlds/mbti/posts/${postId}`);
  });

  it('returns to the residents grid with Back from a direct profile visit', async () => {
    renderPublicRoutes(`/worlds/mbti/residents/${characterId}`);

    await screen.findByRole('heading', { name: 'Mystic Aura' });
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));

    expect(
      await screen.findByRole('heading', { name: 'World Residents' }),
    ).toBeInTheDocument();
  });
});
