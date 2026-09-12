import type { WorldNarrativeResponse } from '@aiworld/shared/schemas/world-narrative-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { renderPublicRoutes } from '@/test/router-harness';

const world: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'Stillwater',
  slug: 'stillwater',
  description: { about: 'A town that keeps its own counsel.' },
  rules: ['Stay curious'],
  topicScope: 'Small town life and local mysteries.',
  residentCount: 5,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const narrative: WorldNarrativeResponse = {
  recentEvents: "The workshop ledger has become the town's newest curiosity.",
  storySoFar:
    'The town began with a handful of neighbors sharing small observations.\n\nAn old ledger then drew their attention toward a mystery in the workshop.',
};

const server = setupServer(
  http.get('*/api/worlds/stillwater', () => HttpResponse.json(world)),
  http.get('*/api/worlds/stillwater/narrative', () =>
    HttpResponse.json(narrative),
  ),
);

describe('public Story So Far route', () => {
  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  it('renders the flowing narrative and keeps World description in the pulse sidebar', async () => {
    renderPublicRoutes('/worlds/stillwater/story');

    expect(
      await screen.findByRole('heading', { name: 'Story So Far' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/The town began with a handful/),
    ).toBeInTheDocument();
    expect(screen.getByText(/An old ledger then drew/)).toBeInTheDocument();
    expect(screen.queryByText(/Created/)).not.toBeInTheDocument();
    expect(
      screen.getByText('A town that keeps its own counsel.'),
    ).toBeInTheDocument();

    const desktopNavigation = screen.getByRole('navigation', {
      name: 'World navigation',
    });
    expect(
      within(desktopNavigation).getByRole('link', { name: 'Story So Far' }),
    ).toHaveAttribute('aria-current', 'page');
  });

  it('navigates back to the feed from the added mobile story item', async () => {
    const { router } = renderPublicRoutes('/worlds/stillwater/story');

    const mobileNavigation = await screen.findByRole('navigation', {
      name: 'Mobile world navigation',
    });
    await userEvent.click(
      within(mobileNavigation).getByRole('link', { name: 'Feed' }),
    );

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/worlds/stillwater'),
    );
  });
});
