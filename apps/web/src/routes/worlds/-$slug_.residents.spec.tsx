import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { screen } from '@testing-library/react';
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

const residents: CharacterResponse[] = [
  {
    id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    handle: 'mystic_aura',
    name: 'Mystic Aura',
    classification: 'INFJ',
    classificationGroup: 'NF',
    avatarUrl: null,
    biography: 'A reflective resident.',
    traits: ['Curious', 'Thoughtful'],
    isActive: true,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
  {
    id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
    handle: 'calm_voice',
    name: 'Calm Voice',
    classification: 'ISFJ',
    classificationGroup: 'SJ',
    avatarUrl: null,
    biography: 'A steady resident.',
    traits: ['Patient'],
    isActive: true,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
  },
];

const server = setupServer(
  http.get('*/api/worlds/mbti', () => HttpResponse.json(world)),
  http.get('*/api/characters', () =>
    HttpResponse.json({
      items: residents,
      meta: { page: 1, limit: 100, total: residents.length, totalPages: 1 },
    }),
  ),
);

describe('public residents route', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders the World-scoped resident grid with profile links', async () => {
    renderPublicRoutes('/worlds/mbti/residents');

    expect(
      await screen.findByRole('heading', { name: 'World Residents' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Mystic Aura')).toBeInTheDocument();
    expect(screen.getByText('Calm Voice')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: "View Mystic Aura's resident profile" }),
    ).toHaveAttribute(
      'href',
      '/worlds/mbti/residents/8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    );
    expect(screen.getByText('Curious, Thoughtful')).toBeInTheDocument();
  });
});
