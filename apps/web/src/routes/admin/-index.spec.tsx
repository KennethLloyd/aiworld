import type {
  AdminCharacterResponse,
  CharacterResponse,
} from '@aiworld/shared/schemas/character-response.schema';
import type { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';
import type { SimulationLogResponse } from '@aiworld/shared/schemas/simulation-log.schema';
import type { SimulationConfigResponse } from '@aiworld/shared/schemas/simulation-state.schema';
import type { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
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
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';

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

const adminCharacter: AdminCharacterResponse = {
  ...character,
  systemPrompt: 'You are a thoughtful resident of the MBTI House.',
};

const worldMember: WorldMemberResponse = {
  id: 'ba3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f15',
  worldId: world.id,
  worldSlug: world.slug,
  characterId: character.id,
  userId: null,
  role: 'AI',
  isActive: true,
  joinedAt: '2026-07-15T10:00:00.000Z',
};

const config: SimulationConfigResponse = {
  id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  worldId: world.id,
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 900_000,
  jitterMs: 300_000,
  actionWeights: { POST: 5, VOTE: 3, COMMENT: 2 },
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
const health: SimulationHealthResponse = {
  lifecycle: { state: 'PAUSED' },
  health: {
    status: 'IDLE',
    reason: 'Simulation is intentionally PAUSED.',
  },
  scheduler: {
    available: true,
    pending: false,
    workExpected: false,
    nextTickAt: null,
    lastTickStartedAt: null,
    lastTickCompletedAt: null,
    retrying: false,
    recentRetryCount: 0,
    deadLetterCount: 0,
    lastDeadLetterAt: null,
    lastDeadLetterReason: null,
    bootResumeFailure: null,
  },
  execution: {
    lastSuccessAt: '2026-07-15T10:00:00.000Z',
    lastFailureAt: null,
  },
  provider: {
    status: 'HEALTHY',
    lastSuccessAt: '2026-07-15T10:00:00.000Z',
    lastFailureAt: null,
  },
  telemetry,
};

const simulationLog: SimulationLogResponse = {
  id: 'aa3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f14',
  worldId: world.id,
  characterId: character.id,
  action: 'COMMENT',
  targetId: null,
  reasoning: 'The resident continued the discussion thoughtfully.',
  provider: 'mock',
  model: 'fixture-model',
  latencyMs: 640,
  jobId: 'job-42',
  executionSource: 'custom',
  tokensUsed: 240,
  costEstimate: 0.08,
  status: 'FAILED',
  errorMessage: 'Provider timed out after the retry budget.',
  executedAt: '2026-07-15T10:05:00.000Z',
};

let currentConfig: SimulationConfigResponse;
let stateRequests: string[];
let speedRequests: number[];
let customActionRequests: Record<string, unknown>[];
let healthRequests: number;
let logRequests: number;
let logQueryRequests: URLSearchParams[];
let currentWorld: WorldResponse;
let characterRequests: Record<string, unknown>[];

const server = setupServer(
  http.get('*/api/worlds', () =>
    HttpResponse.json({
      items: [world],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/worlds/mbti-house', () => HttpResponse.json(currentWorld)),
  http.patch('*/api/worlds/mbti-house', async ({ request }) => {
    const body = (await request.json()) as Partial<WorldResponse>;
    currentWorld = {
      ...currentWorld,
      ...body,
      updatedAt: '2026-07-15T11:00:00.000Z',
    };
    return HttpResponse.json(currentWorld);
  }),
  http.get('*/api/characters', () =>
    HttpResponse.json({
      items: [adminCharacter],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.get('*/api/world-members', () =>
    HttpResponse.json({
      items: [worldMember],
      meta: { page: 1, limit: 100, total: 1, totalPages: 1 },
    }),
  ),
  http.post('*/api/characters', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    characterRequests.push(body);
    return HttpResponse.json(adminCharacter, { status: 201 });
  }),
  http.patch('*/api/characters/:characterId', async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>;
    characterRequests.push(body);
    return HttpResponse.json({ ...adminCharacter, ...body });
  }),
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
  http.get('*/api/worlds/mbti-house/simulation/health', () => {
    healthRequests += 1;
    return HttpResponse.json({
      ...health,
      lifecycle: { state: currentConfig.state },
      health:
        currentConfig.state === 'PAUSED'
          ? health.health
          : { status: 'HEALTHY', reason: null },
    });
  }),
  http.get('*/api/worlds/mbti-house/simulation/logs', ({ request }) => {
    logRequests += 1;
    logQueryRequests.push(new URL(request.url).searchParams);
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
  beforeEach(() => {
    currentWorld = { ...world };
    characterRequests = [];
    currentConfig = { ...config };
    stateRequests = [];
    speedRequests = [];
    customActionRequests = [];
    healthRequests = 0;
    logRequests = 0;
    logQueryRequests = [];
  });
  afterEach(() => {
    server.resetHandlers();
    currentWorld = { ...world };
    characterRequests = [];
    currentConfig = { ...config };
    stateRequests = [];
    speedRequests = [];
    customActionRequests = [];
    healthRequests = 0;
    logRequests = 0;
    logQueryRequests = [];
  });
  afterAll(() => server.close());

  it('warns when lifecycle is RUNNING but runtime health is unhealthy', async () => {
    currentConfig = { ...config, state: 'RUNNING' };
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/health', () =>
        HttpResponse.json({
          ...health,
          lifecycle: { state: 'RUNNING' },
          health: {
            status: 'UNHEALTHY',
            reason: 'Scheduler worker is unavailable.',
          },
          scheduler: {
            ...health.scheduler,
            available: false,
          },
        }),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    expect(
      await screen.findByText('Runtime health: UNHEALTHY'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Scheduler worker is unavailable.'),
    ).toBeInTheDocument();
  });
  it('renders the World overview with lifecycle and health separated', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=overview', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'The MBTI House' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Lifecycle: PAUSED')).toBeInTheDocument();
    expect(screen.getByText('Health: IDLE')).toBeInTheDocument();
    expect(screen.getByText('Operational pulse')).toBeInTheDocument();
    expect(screen.getByText('Simulation health')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Run One Action' }),
    ).not.toBeInTheDocument();
  });

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
    const worldPicker = await screen.findByRole('combobox', {
      name: 'Selected World',
    });
    expect(worldPicker).toHaveAttribute('data-value', 'mbti-house');
    await userEvent.click(worldPicker);
    expect(
      screen.getByRole('listbox', { name: 'World options' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('option', {
        name: 'The MBTI House (mbti-house)',
      }),
    );
    expect(worldPicker).toHaveAttribute('aria-expanded', 'false');
    expect(await screen.findAllByText('PAUSED')).not.toHaveLength(0);
    expect(await screen.findByText('8')).toBeInTheDocument();
    expect(screen.getByText('Runtime Health')).toBeInTheDocument();
    expect(screen.getByText('Last Successful Execution')).toBeInTheDocument();
    expect(screen.getByText('Jitter window')).toBeInTheDocument();
    expect(screen.getByText('±5m')).toBeInTheDocument();
    expect(screen.getByText('Post 5')).toBeInTheDocument();
    expect(screen.getByText('Vote 3')).toBeInTheDocument();
    expect(screen.getByText('Comment 2')).toBeInTheDocument();
    expect(screen.getByText('Success')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Run One Action' }),
    ).toBeInTheDocument();
  });

  it('searches Worlds beyond the initial page without changing selection', async () => {
    const distantWorld: WorldResponse = {
      ...world,
      id: '3a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f16',
      name: 'The Starship',
      slug: 'the-starship',
    };
    const worldSearches: string[] = [];
    server.use(
      http.get('*/api/worlds', ({ request }) => {
        const searchParams = new URL(request.url).searchParams;
        const search = searchParams.get('search') ?? '';
        const page = Number(searchParams.get('page') ?? 1);
        worldSearches.push(search);
        const searchable = search !== '';
        return HttpResponse.json({
          items: searchable || page === 2 ? [distantWorld] : [world],
          meta: {
            page,
            limit: 20,
            total: searchable ? 1 : 2,
            totalPages: searchable ? 1 : 2,
          },
        });
      }),
    );
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=overview', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: world.name }),
    ).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole('combobox', { name: 'Selected World' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(
      await screen.findByRole('option', {
        name: 'The Starship (the-starship)',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: world.name }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(
      await screen.findByRole('option', {
        name: 'The MBTI House (mbti-house)',
      }),
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByRole('searchbox', { name: 'Search Worlds' }),
      'starship',
    );

    await waitFor(() => expect(worldSearches).toContain('starship'));
    expect(
      await screen.findByRole('option', {
        name: 'The Starship (the-starship)',
      }),
    ).toBeInTheDocument();
    const searchInput = screen.getByRole('searchbox', {
      name: 'Search Worlds',
    });
    expect(searchInput).toHaveAttribute(
      'aria-activedescendant',
      'admin-selected-world-options-the-starship',
    );
    expect(worldSearches).toContain('starship');
    expect(
      screen.getByRole('heading', { name: world.name }),
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
        name: 'Active Characters unavailable',
      }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No active Characters.')).not.toBeInTheDocument();
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

    await userEvent.selectOptions(screen.getByLabelText('Speed'), '2');
    await waitFor(() => expect(speedRequests).toEqual([2]));
    expect(await screen.findByText('Speed saved')).toBeInTheDocument();
  });

  it('keeps Run available and disables invalid lifecycle actions when halted', async () => {
    currentConfig = { ...config, state: 'HALTED' };
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    await screen.findAllByText('HALTED');

    expect(screen.getByRole('button', { name: 'Run' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Halt' })).toBeDisabled();
  });

  it('runs a targeted custom action and refreshes health and logs', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/', { queryClient: client });

    await screen.findAllByText('PAUSED');
    await userEvent.selectOptions(
      screen.getByLabelText('Character'),
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
      expect(healthRequests).toBeGreaterThan(1);
      expect(logRequests).toBeGreaterThan(1);
    });
  });

  it('filters, paginates, and expands authorized simulation log details', async () => {
    const pageTwoLog: SimulationLogResponse = {
      ...simulationLog,
      id: 'ba3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f15',
      jobId: 'job-43',
      reasoning: 'The second page contains a newer execution.',
    };
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/logs', ({ request }) => {
        const search = new URL(request.url).searchParams;
        logQueryRequests.push(search);
        return HttpResponse.json({
          items: [search.get('page') === '2' ? pageTwoLog : simulationLog],
          meta: {
            page: Number(search.get('page') ?? 1),
            limit: Number(search.get('limit') ?? 10),
            total: 2,
            totalPages: 2,
          },
        });
      }),
    );
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=logs', { queryClient: client });

    const desktopLogTable = await screen.findByRole('region', {
      name: 'Simulation log records table',
    });
    expect(
      await within(desktopLogTable).findByRole('button', {
        name: 'Show desktop details for Mystic Aura',
      }),
    ).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText('Character'),
      character.id,
    );
    await userEvent.selectOptions(screen.getByLabelText('Action'), 'COMMENT');
    await userEvent.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    await userEvent.selectOptions(screen.getByLabelText('Source'), 'custom');

    await waitFor(() => {
      const latest = logQueryRequests.at(-1);
      expect(latest?.get('characterId')).toBe(character.id);
      expect(latest?.get('action')).toBe('COMMENT');
      expect(latest?.get('status')).toBe('FAILED');
      expect(latest?.get('executionSource')).toBe('custom');
      expect(latest?.get('page')).toBe('1');
    });

    await userEvent.click(
      within(desktopLogTable).getByRole('button', {
        name: 'Show desktop details for Mystic Aura',
      }),
    );
    expect(
      await within(desktopLogTable).findByText(
        'Provider timed out after the retry budget.',
      ),
    ).toBeInTheDocument();
    expect(within(desktopLogTable).getByText('job-42')).toBeInTheDocument();
    expect(within(desktopLogTable).getByText('mock')).toBeInTheDocument();
    expect(
      screen.queryByText(/promptUsed|responseRaw/i),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Export CSV/i }),
    ).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Next page' }));
    await waitFor(() => expect(logQueryRequests.at(-1)?.get('page')).toBe('2'));
    await userEvent.click(
      within(desktopLogTable).getByRole('button', {
        name: 'Show desktop details for Mystic Aura',
      }),
    );
    expect(
      await within(desktopLogTable).findByText('job-43'),
    ).toBeInTheDocument();
    expect(screen.queryByText('job-42')).not.toBeInTheDocument();
  });

  it('renders all log status and execution-source options', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=logs', { queryClient: client });

    await screen.findByRole('heading', { name: 'Simulation Logs' });
    expect(screen.getByRole('option', { name: 'Success' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Failed' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Skipped' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Rejected' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Scheduled' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'One Action' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Custom' })).toBeInTheDocument();
  });
  it('keeps log filters and pagination in the admin URL', async () => {
    const user = userEvent.setup();
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes('/admin/?tab=logs', {
      queryClient: client,
    });

    await screen.findByRole('heading', { name: 'Simulation Logs' });
    await user.selectOptions(screen.getByLabelText('Status'), 'FAILED');

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        tab: 'logs',
        logStatus: 'FAILED',
      }),
    );
    expect(logQueryRequests.at(-1)?.get('status')).toBe('FAILED');
  });

  it('renders an empty log state for a filter with no matches', async () => {
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/logs', () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=logs', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'No simulation logs' }),
    ).toBeInTheDocument();
  });

  it('renders a forbidden state when simulation logs are denied', async () => {
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/logs', () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden', error: 'Forbidden' },
          { status: 403 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=logs', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument();
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

  it('loads and saves the selected World from the World Config tab', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=world', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'World Config' }),
    ).toBeInTheDocument();
    const nameInput = await screen.findByLabelText('Name');
    expect(nameInput).toHaveValue(world.name);

    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'The Updated House');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));

    expect(await screen.findByText('World updated')).toBeInTheDocument();
    expect(currentWorld.name).toBe('The Updated House');
  });

  it('opens the selected World Residents tab with separate status controls', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=members', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Residents' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Members' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect((await screen.findAllByText('Mystic Aura')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getByText('1 AI Resident')).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', {
        name: 'Deactivate membership for Mystic Aura',
      }).length,
    ).toBeGreaterThan(0);
  });

  it('blocks leaving a dirty World Config draft until the admin decides', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes('/admin/?tab=world', {
      queryClient: client,
    });

    const nameInput = await screen.findByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Unsaved World');
    await userEvent.click(screen.getByRole('tab', { name: 'Characters' }));

    expect(
      await screen.findByRole('dialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    expect(router.state.location.search).toMatchObject({ tab: 'world' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue editing' }),
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Unsaved World');

    await userEvent.click(screen.getByRole('tab', { name: 'Characters' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard changes' }),
    );
    expect(
      await screen.findByRole('heading', {
        name: 'Global Character Registry',
      }),
    ).toBeInTheDocument();
  });

  it('keeps the World draft visible when a save request fails', async () => {
    server.use(
      http.patch('*/api/worlds/mbti-house', () =>
        HttpResponse.json(
          { statusCode: 503, message: 'World service unavailable' },
          { status: 503 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=world', { queryClient: client });

    const worldName = await screen.findByLabelText('Name');
    await userEvent.clear(worldName);
    await userEvent.type(worldName, 'Draft World');
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    expect(
      await screen.findByText('World service unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Draft World');
  });

  it('keeps the Character draft visible when a save request fails', async () => {
    server.use(
      http.patch('*/api/characters/:characterId', () =>
        HttpResponse.json(
          { statusCode: 503, message: 'Character service unavailable' },
          { status: 503 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=characters', { queryClient: client });

    await screen.findByRole('heading', { name: 'Global Character Registry' });
    const editButtons = await screen.findAllByRole('button', {
      name: 'Edit Mystic Aura',
    });
    await userEvent.click(editButtons[0]!);
    const nameInput = await screen.findByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Draft Character');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save character' }),
    );

    expect(
      await screen.findByText('Character service unavailable'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Name')).toHaveValue('Draft Character');
  });

  it('loads the admin Character registry and saves the full editor payload', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=characters', { queryClient: client });

    expect(
      await screen.findByRole('heading', {
        name: 'Global Character Registry',
      }),
    ).toBeInTheDocument();
    const editButtons = await screen.findAllByRole('button', {
      name: 'Edit Mystic Aura',
    });
    await userEvent.click(editButtons[0]!);

    const systemPrompt = await screen.findByLabelText('System prompt');
    expect(systemPrompt).toHaveValue(adminCharacter.systemPrompt);
    const nameInput = screen.getByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Mystic Aura Revised');
    await userEvent.click(
      screen.getByRole('button', { name: 'Save character' }),
    );

    expect(await screen.findByText('Character updated')).toBeInTheDocument();
    expect(characterRequests).toHaveLength(1);
    expect(characterRequests[0]).toMatchObject({
      name: 'Mystic Aura Revised',
      systemPrompt: adminCharacter.systemPrompt,
      traits: ['Curious'],
    });
  });

  it('keeps the global Character registry available without any Worlds', async () => {
    server.use(
      http.get('*/api/worlds', () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, limit: 100, total: 0, totalPages: 0 },
        }),
      ),
    );
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=characters', { queryClient: client });

    expect(
      await screen.findByRole('heading', {
        name: 'Global Character Registry',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'New Character' }),
    ).toBeInTheDocument();
  });

  it('opens the global Character registry from its first-class route', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes('/admin/characters', {
      queryClient: client,
    });

    expect(
      await screen.findByRole('heading', {
        name: 'Global Character Registry',
      }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe('/admin/characters');
    expect(
      screen.getByText(/editing a Character never changes World membership/i),
    ).toBeInTheDocument();
  });
  it('renders an explicit not-found state for an unavailable World slug', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=world&world=missing-world', {
      queryClient: client,
    });

    expect(
      await screen.findByRole('heading', { name: 'World not found' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Choose another World.')).toBeInTheDocument();
  });

  it('creates an unassigned Character through the existing admin API flow', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=characters', { queryClient: client });

    await screen.findByRole('heading', { name: 'Global Character Registry' });
    await userEvent.click(
      screen.getByRole('button', { name: 'New Character' }),
    );
    await userEvent.type(screen.getByLabelText('Handle'), 'new_character');
    await userEvent.type(screen.getByLabelText('Name'), 'New Character');
    await userEvent.type(
      screen.getByLabelText('System prompt'),
      'You are a new character.',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Create character' }),
    );

    expect(await screen.findByText('Character created')).toBeInTheDocument();
    expect(characterRequests[0]).toMatchObject({
      handle: 'new_character',
      name: 'New Character',
      systemPrompt: 'You are a new character.',
    });
  });

  it('preserves a dirty Character draft until the admin explicitly discards it', async () => {
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=characters', { queryClient: client });

    await screen.findByRole('heading', { name: 'Global Character Registry' });
    const editButtons = await screen.findAllByRole('button', {
      name: 'Edit Mystic Aura',
    });
    await userEvent.click(editButtons[0]!);
    const nameInput = await screen.findByLabelText('Name');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Unsaved Character');
    await userEvent.click(screen.getByRole('button', { name: 'Close editor' }));

    expect(
      await screen.findByRole('dialog', { name: 'Unsaved changes' }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Continue editing' }),
    );
    expect(screen.getByLabelText('Name')).toHaveValue('Unsaved Character');

    await userEvent.click(screen.getByRole('button', { name: 'Close editor' }));
    await userEvent.click(
      screen.getByRole('button', { name: 'Discard changes' }),
    );
    expect(
      screen.queryByRole('heading', { name: /Edit Mystic Aura/ }),
    ).not.toBeInTheDocument();
  });

  it('renders a forbidden state when the admin Character registry is denied', async () => {
    server.use(
      http.get('*/api/characters', () =>
        HttpResponse.json(
          { statusCode: 403, message: 'Forbidden' },
          { status: 403 },
        ),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=characters', { queryClient: client });

    expect(
      await screen.findByRole('heading', { name: 'Access denied' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('You need the ADMIN role to view this content.'),
    ).toBeInTheDocument();
  });
  it('keeps global Character filters in the shareable admin URL', async () => {
    const user = userEvent.setup();
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes(
      '/admin/characters?characterSearch=mystic&characterIsActive=false',
      { queryClient: client },
    );

    const searchInput = await screen.findByLabelText('Search Characters');
    expect(searchInput).toHaveValue('mystic');
    await user.clear(searchInput);
    await user.type(searchInput, 'orbit');

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        characterSearch: 'orbit',
        characterPage: 1,
        characterIsActive: false,
      }),
    );

    await user.selectOptions(await screen.findByLabelText('Status'), 'active');
    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        characterSearch: 'orbit',
        characterPage: 1,
        characterIsActive: true,
      }),
    );
  });

  it('persists selected log details and clears them when filters change', async () => {
    const user = userEvent.setup();
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/logs', ({ request }) => {
        const params = new URL(request.url).searchParams;
        return HttpResponse.json({
          items: [simulationLog],
          meta: {
            page: Number(params.get('page') ?? 1),
            limit: 10,
            total: 1,
            totalPages: 1,
          },
        });
      }),
    );
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes('/admin/?tab=logs', {
      queryClient: client,
    });

    const table = await screen.findByRole('region', {
      name: 'Simulation log records table',
    });
    await user.click(
      within(table).getByRole('button', {
        name: 'Show desktop details for Mystic Aura',
      }),
    );

    await waitFor(() =>
      expect(router.state.location.search).toMatchObject({
        tab: 'logs',
        log: simulationLog.id,
      }),
    );
    expect(
      within(table).getByText('Provider timed out after the retry budget.'),
    ).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText('Status'), 'FAILED');
    await waitFor(() =>
      expect(router.state.location.search.log).toBeUndefined(),
    );
  });

  it('keeps precise small costs visible in log details', async () => {
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/logs', () =>
        HttpResponse.json({
          items: [{ ...simulationLog, costEstimate: 0.001833 }],
          meta: { page: 1, limit: 10, total: 1, totalPages: 1 },
        }),
      ),
    );
    const client = createQueryClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    renderAuthRoutes('/admin/?tab=logs', { queryClient: client });

    const table = await screen.findByRole('region', {
      name: 'Simulation log records table',
    });
    await userEvent.click(
      within(table).getByRole('button', {
        name: 'Show desktop details for Mystic Aura',
      }),
    );

    expect(screen.getAllByText('$0.001833').length).toBeGreaterThan(0);
  });

  it('offers recovery when a selected log is no longer available', async () => {
    server.use(
      http.get('*/api/worlds/mbti-house/simulation/logs', () =>
        HttpResponse.json({
          items: [],
          meta: { page: 1, limit: 10, total: 0, totalPages: 0 },
        }),
      ),
    );
    const client = retryDisabledClient();
    client.setQueryData(['session', 'current'], makeSession('ADMIN'));
    const { router } = renderAuthRoutes(
      `/admin/?tab=logs&log=${simulationLog.id}`,
      { queryClient: client },
    );

    expect(
      await screen.findByRole('alert', {
        name: 'Selected log unavailable',
      }),
    ).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', { name: 'Clear selected log' }),
    );
    await waitFor(() =>
      expect(router.state.location.search.log).toBeUndefined(),
    );
  });
});
