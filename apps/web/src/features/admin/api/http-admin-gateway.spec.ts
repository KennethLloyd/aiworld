import type { SimulationRunResultResponse } from '@aiworld/shared/schemas/simulation-run.schema';
import type { SimulationConfigResponse } from '@aiworld/shared/schemas/simulation-state.schema';
import type { SimulationTelemetryResponse } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { HttpClient } from '@/core/api/http-client';

import { HttpAdminGateway } from './http-admin-gateway';

const config: SimulationConfigResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  worldId: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 900_000,
  jitterMs: 300_000,
  actionWeights: { POST: 5, VOTE: 3, COMMENT: 2 },
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const telemetry: SimulationTelemetryResponse = {
  worldId: config.worldId,
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

const runResult: SimulationRunResultResponse = {
  status: 'success',
  log: {
    id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
    worldId: config.worldId,
    characterId: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
    action: 'POST',
    targetId: null,
    reasoning: 'The resident had something to say.',
    provider: 'mock',
    model: 'fixture-model',
    latencyMs: 420,
    jobId: null,
    executionSource: 'custom',
    tokensUsed: 120,
    costEstimate: 0.04,
    status: 'SUCCESS',
    errorMessage: null,
    executedAt: '2026-07-15T10:00:00.000Z',
  },
};

const http = new HttpClient('');
const gateway = new HttpAdminGateway(http);

describe('HttpAdminGateway', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  function mockFetch(body: unknown, status = 200) {
    const fetchMock = vi.fn<typeof fetch>(async () => {
      return new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
      });
    });
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
  }

  it('parses the simulation config and addresses a slug safely', async () => {
    const fetchMock = mockFetch(config);

    await expect(gateway.getSimulation('mbti house')).resolves.toEqual(config);

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti%20house/simulation',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('serializes lifecycle and speed commands through the shared endpoints', async () => {
    const fetchMock = mockFetch(config);

    await gateway.updateSimulationState('mbti-house', { state: 'RUNNING' });
    await gateway.updateSimulationSpeed('mbti-house', {
      speedMultiplier: 2,
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/worlds/mbti-house/simulation/state',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ state: 'RUNNING' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/worlds/mbti-house/simulation/speed',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ speedMultiplier: 2 }),
      }),
    );
  });

  it('supports automatic and targeted custom actions plus Run One Action', async () => {
    const fetchMock = mockFetch(runResult);

    await expect(gateway.runOneAction('mbti-house')).resolves.toEqual(
      runResult,
    );
    await gateway.runCustomAction('mbti-house', {});
    await gateway.runCustomAction('mbti-house', {
      characterId: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
      actionType: 'COMMENT',
    });

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/worlds/mbti-house/simulation/run-one-action',
      expect.objectContaining({ method: 'POST' }),
    );
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body');
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      '/api/worlds/mbti-house/simulation/custom-action',
      expect.objectContaining({ method: 'POST', body: '{}' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      '/api/worlds/mbti-house/simulation/custom-action',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          characterId: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
          actionType: 'COMMENT',
        }),
      }),
    );
  });

  it('parses telemetry and filtered recent logs', async () => {
    const fetchMock = mockFetch({
      items: [runResult.log],
      meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
    });

    await expect(
      gateway.listSimulationLogs('mbti-house', { page: 1, limit: 5 }),
    ).resolves.toEqual({
      items: [runResult.log],
      meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/worlds/mbti-house/simulation/logs?page=1&limit=5',
      expect.objectContaining({ method: 'GET' }),
    );

    const telemetryFetch = mockFetch(telemetry);
    await expect(gateway.getSimulationTelemetry('mbti-house')).resolves.toEqual(
      telemetry,
    );
    expect(telemetryFetch).toHaveBeenCalledWith(
      '/api/worlds/mbti-house/simulation/telemetry',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('rejects malformed simulation responses at the gateway boundary', async () => {
    mockFetch({ state: 'RUNNING' });

    await expect(gateway.getSimulation('mbti-house')).rejects.toBeInstanceOf(
      ZodError,
    );
  });
});
