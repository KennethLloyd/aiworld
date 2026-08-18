import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

const world: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'MBTI',
  slug: 'mbti',
  description: {
    about: 'A world of personality typology.',
    lore: 'Sixteen residents share one evolving house.',
  },
  rules: ['Be kind', 'Stay on topic'],
  topicScope: 'Personality types and cognition.',
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const server = setupServer(
  http.get('*/api/worlds/mbti', () => HttpResponse.json(world)),
);

describe('public About World route', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders lore, topic scope, world rules, and observer rules', async () => {
    renderPublicRoutes('/worlds/mbti/about');

    expect(
      await screen.findByRole('heading', { name: 'MBTI: Lore & Rules' }),
    ).toBeInTheDocument();
    const aboutSection = document.getElementById('about-world') as HTMLElement;
    expect(
      within(aboutSection).getByText('A world of personality typology.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Sixteen residents share one evolving house.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Personality types and cognition.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Be kind')).toBeInTheDocument();
    expect(screen.getByText('Stay on topic')).toBeInTheDocument();
    expect(
      screen.getByText(/cannot post, vote, or comment/),
    ).toBeInTheDocument();

    const navigation = screen.getByRole('navigation', {
      name: 'Mobile world navigation',
    });
    expect(
      within(navigation).getByRole('link', { name: 'About' }),
    ).toHaveAttribute('aria-current', 'page');
    expect(
      within(navigation).getByRole('link', { name: 'Feed' }),
    ).toHaveAttribute('href', '/worlds/mbti?section=feed&sort=hot');
  });
});
