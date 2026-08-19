import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { SimulationConfigResponse } from '@aiworld/shared/schemas/simulation-state.schema';
import type { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient } from '@tanstack/react-query';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { createQueryClient } from '@/providers/query-client';
import { renderAuthRoutes } from '@/test/auth-router-harness';
import { makeSession } from '@/test/fixtures/auth-session';

const world: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: { about: 'A simulated home for sixteen personalities.' },
  rules: ['Stay in character'],
  topicScope: 'Personality types and everyday life.',
  residentCount: 1,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const character: CharacterResponse = {
  id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
  handle: 'mystic_aura',
  name: 'Mystic Aura',
  classification: 'INFJ',
  classificationGroup: 'NF',
  avatarUrl: null,
  biography: 'A reflective resident.',
  traits: ['Curious'],
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const config: SimulationConfigResponse = {
  id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  worldId: world.id,
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 900_000,
  jitterMs: 300_000,
  actionWeights: { POST: 5, VOTE: 3, COMMENT: 2 },
  providerId: 'mock',
  model: 'fixture-model',
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const telemetry: SimulationTelemetryResponse = {
  worldId: world.id,
  totalRuns: 8,
  successCount: 7,
  failedCount: 1,
  skippedCount: 0,
  rejectedCount: 0,
  totalTokensUsed: 1_200,
  totalCostEstimateUsd: 0.42,
  averageLatencyMs: 480,
  lastRunAt: '2026-07-15T10:00:00.000Z',
};

let currentConfig: SimulationConfigResponse;
let stateRequests: string[];
let speedRequests: number[];
let customActionRequests: Record<string, unknown>[];
let telemetryRequests: number;
let logRequests: number;

const server = setupServer(
  http.get('*/api/worlds', () =>
    HttpResponse.json({
      items: [world],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/characters', () =>
    HttpResponse.json({
      items: [character],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/worlds/mbti-house/simulation', () =>
    HttpResponse.json(currentConfig),
  ),
  http.patch(
    '*/api/worlds/mbti-house/simulation/state',
    async ({ request }) => {
      const body = (await request.json()) as {
        state: SimulationConfigResponse['state'];
      };
      stateRequests.push(body.state);
      currentConfig = { ...currentConfig, state: body.state };
      return HttpResponse.json(currentConfig);
    },
  ),
  http.patch(
    '*/api/worlds/mbti-house/simulation/speed',
    async ({ request }) => {
      const body = (await request.json()) as { speedMultiplier: number };
      speedRequests.push(body.speedMultiplier);
      currentConfig = {
        ...currentConfig,
        speedMultiplier: body.speedMultiplier,
      };
      return HttpResponse.json(currentConfig);
    },
  ),
  http.post('*/api/worlds/mbti-house/simulation/run-one-action', () =>
    HttpResponse.json(makeRunResult('one-action')),
  ),
  http.post(
    '*/api/worlds/mbti-house/simulation/custom-action',
    async ({ request }) => {
      const body = (await request.json()) as Record<string, unknown>;
      customActionRequests.push(body);
      return HttpResponse.json(makeRunResult('custom'));
    },
  ),
  http.get('*/api/worlds/mbti-house/simulation/telemetry', () => {
    telemetryRequests += 1;
    return HttpResponse.json(telemetry);
  }),
  http.get('*/api/worlds/mbti-house/simulation/logs', () => {
    logRequests += 1;
    return HttpResponse.json({
      items: [],
      meta: { page: 1, limit: 5, total: 0, totalPages: 0 },
    });
  }),
);

function makeRunResult(executionSource: 'one-action' | 'custom') {
  return {
    status: 'success',
    log: {
      id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
      worldId: world.id,
      characterId: character.id,
      action: 'POST',
      targetId: null,
      reasoning: 'A test action completed.',
      provider: 'mock',
      model: 'fixture-model',
      latencyMs: 420,
      jobId: null,
      executionSource,
      tokensUsed: 120,
      costEstimate: 0.04,
      status: 'SUCCESS',
      errorMessage: null,
      executedAt: '2026-07-15T10:00:00.000Z',
    },
  };
}

function retryDisabledClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
}

describe('/admin control room', () => {
  beforeAll(() => server.listen());
  afterEach(() => {
    server.resetHandlers();
    currentConfig = { ...config };
    stateRequests = [];
    speedRequests = [];
    customActionRequests = [];
    telemetryRequests = 0;
    logRequests = 0;
  });
  afterAll(() => server.close());

  it('redirects anonymous visitors to sign-in', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], null);

    const { router } = renderAuthRoutes('/admin/', { queryClient: client });

    await waitFor(() =>
      expect(router.state.location.pathname).toBe('/auth/sign-in'),
    );
  });

  it('renders the selected World shell and status data from the API', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));

    renderAuthRoutes('/admin/', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: /WORLD_ENGINE/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('tab', { name: 'Simulation Status' }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByLabelText('Selected World')).toHaveValue(
      'mbti-house',
    );
    expect(await screen.findAllByText('PAUSED')).not.toHaveLength(0);
    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Run One Action' }),
    ).toBeInTheDocument();
  });

  it('shows a retryable resident API error without mislabeling it as empty', async () => {
    server.use(
      http.get('*/api/characters', () =>
        HttpResponse.json(
          { statusCode: 503, message: 'Resident directory unavailable' },
          { status: 503 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    expect(
      await screen.findByRole('heading', {
        name: 'Could not load active AI Residents',
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(
        'No active AI Residents are available for manual work.',
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('moves between control-room tabs with arrow keys', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes('/admin/', { queryClient: client });

    const statusTab = await screen.findByRole('tab', {
      name: 'Simulation Status',
    });
    statusTab.focus();
    await userEvent.keyboard('{ArrowRight}');

    expect(screen.getByRole('tab', { name: 'World Config' })).toHaveFocus();
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({ tab: 'world' }),
    );
  });

  it('persists state and speed changes with pending controls', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    await screen.findAllByText('PAUSED');
    await userEvent.click(screen.getByRole('button', { name: 'Run' }));
    await waitFor(() => expect(stateRequests).toEqual(['RUNNING']));

    await userEvent.selectOptions(
      screen.getByLabelText('Simulation speed'),
      '2',
    );
    await waitFor(() => expect(speedRequests).toEqual([2]));
    expect(await screen.findByText('Speed saved')).toBeInTheDocument();
  });

  it('runs a targeted custom action and refreshes telemetry and logs', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    await screen.findAllByText('PAUSED');
    await userEvent.selectOptions(
      screen.getByLabelText('Target AI Resident'),
      character.id,
    );
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'COMMENT');
    await userEvent.click(
      screen.getByRole('button', { name: 'Custom Action' }),
    );

    expect(
      await screen.findByText(/Custom action completed/),
    ).toBeInTheDocument();
    expect(customActionRequests).toEqual([
      { characterId: character.id, actionType: 'COMMENT' },
    ]);
    await waitFor(() => {
      expect(telemetryRequests).toBeGreaterThan(1);
      expect(logRequests).toBeGreaterThan(1);
    });
  });

  it('shows an accessible HALTED refusal from the server', async () => {
    currentConfig = { ...config, state: 'RUNNING' };
    server.use(
      http.post('*/api/worlds/mbti-house/simulation/run-one-action', () =>
        HttpResponse.json(
          {
            statusCode: 409,
            message: 'Simulation manual work is rejected in state HALTED',
            error: 'Conflict',
          },
          { status: 409 },
        ),
      ),
    );
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    await screen.findAllByText('RUNNING');
    await userEvent.click(
      screen.getByRole('button', { name: 'Run One Action' }),
    );

    const alert = await screen.findByRole('alert', {
      name: 'Simulation action refused',
    });
    expect(within(alert).getByText(/HALTED/)).toBeInTheDocument();
  });

  it('handles a simulation API failure with retry', async () => {
    server.use(
      http.get('*/api/worlds/mbti-house/simulation', () =>
        HttpResponse.json(
          { statusCode: 500, message: 'Internal Server Error', error: 'Error' },
          { status: 500 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Could not load simulation' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
