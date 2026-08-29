import type { SimulationHealthResponse } from '@aiworld/shared/schemas/simulation-health.schema';

import type { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import type { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import type { SimulationSchedulerObservabilityRecord } from '@/simulation/scheduler/simulation-scheduler.port';

export type SimulationHealthStatus =
  SimulationHealthResponse['health']['status'];
export type SimulationProviderHealthStatus =
  SimulationHealthResponse['provider']['status'];

export type SimulationHealthDecision = {
  status: SimulationHealthStatus;
  reason: string | null;
  providerStatus: SimulationProviderHealthStatus;
};
export type SimulationHealthInput = {
  config: WorldSimulationConfigRecord;
  scheduler: SimulationSchedulerObservabilityRecord;
  telemetry: SimulationTelemetryRecord;
};

export const SIMULATION_HEALTH_RECENCY_WINDOW_MS = 15 * 60 * 1_000;

type ProviderExecutionTimestamps = {
  lastSuccessAt: Date | null;
  lastFailureAt: Date | null;
  lastProviderSuccessAt: Date | null;
  lastProviderFailureAt: Date | null;
};

export function normalizeProviderExecutionTimestamps(
  telemetry: SimulationTelemetryRecord,
): ProviderExecutionTimestamps {
  const lastSuccessAt = telemetry.lastSuccessAt ?? null;
  const lastFailureAt = telemetry.lastFailureAt ?? null;
  return {
    lastSuccessAt,
    lastFailureAt,
    lastProviderSuccessAt:
      telemetry.lastProviderSuccessAt === undefined
        ? lastSuccessAt
        : telemetry.lastProviderSuccessAt,
    lastProviderFailureAt:
      telemetry.lastProviderFailureAt === undefined
        ? lastFailureAt
        : telemetry.lastProviderFailureAt,
  };
}

function isRecent(
  timestamp: Date | null,
  now: Date,
  windowMs = SIMULATION_HEALTH_RECENCY_WINDOW_MS,
): boolean {
  return timestamp !== null && now.getTime() - timestamp.getTime() <= windowMs;
}

/** Derives operator-facing health from lifecycle state and runtime evidence.
 * Lifecycle states intentionally short-circuit to IDLE: PAUSED and HALTED are
 * deliberate controls, not scheduler incidents. A RUNNING World is healthy
 * only when its live scheduler has pending work and no active incident. */
export type SimulationHealthRecord = {
  lifecycleState: WorldSimulationConfigRecord['state'];
  health: {
    status: SimulationHealthStatus;
    reason: string | null;
  };
  scheduler: SimulationSchedulerObservabilityRecord;
  execution: {
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
  };
  provider: {
    status: SimulationProviderHealthStatus;
    lastSuccessAt: Date | null;
    lastFailureAt: Date | null;
  };
  telemetry: SimulationTelemetryRecord;
};
export function deriveSimulationHealth(
  input: SimulationHealthInput,
  now = new Date(),
): SimulationHealthDecision {
  const { config, scheduler, telemetry } = input;
  const {
    lastSuccessAt,
    lastFailureAt,
    lastProviderSuccessAt,
    lastProviderFailureAt,
  } = normalizeProviderExecutionTimestamps(telemetry);
  const effectiveCadenceMs =
    config.speedMultiplier > 0
      ? (config.intervalMs + config.jitterMs) / config.speedMultiplier
      : SIMULATION_HEALTH_RECENCY_WINDOW_MS;
  const healthFreshnessWindowMs = Math.max(
    SIMULATION_HEALTH_RECENCY_WINDOW_MS,
    effectiveCadenceMs,
  );
  const providerFailureIsRecent =
    lastProviderFailureAt !== null &&
    isRecent(lastProviderFailureAt, now, healthFreshnessWindowMs) &&
    (lastProviderSuccessAt === null ||
      lastProviderFailureAt > lastProviderSuccessAt);
  const providerStatus: SimulationProviderHealthStatus = providerFailureIsRecent
    ? 'DEGRADED'
    : lastProviderSuccessAt !== null &&
        isRecent(lastProviderSuccessAt, now, healthFreshnessWindowMs)
      ? 'HEALTHY'
      : 'UNKNOWN';

  if (config.state !== 'RUNNING') {
    return {
      status: 'IDLE',
      reason: `Simulation is intentionally ${config.state}.`,
      providerStatus,
    };
  }

  if (scheduler.bootResumeFailure !== null) {
    return {
      status: 'UNHEALTHY',
      reason: `Scheduler resume failed: ${scheduler.bootResumeFailure.reason}`,
      providerStatus,
    };
  }

  if (!scheduler.available) {
    return {
      status: 'UNHEALTHY',
      reason: 'Scheduler worker is unavailable.',
      providerStatus,
    };
  }
  if (scheduler.retrying || scheduler.recentRetryCount > 0) {
    return {
      status: 'DEGRADED',
      reason: 'Scheduler retries are active or accumulating.',
      providerStatus,
    };
  }

  const tickInFlight =
    scheduler.lastTickStartedAt !== null &&
    (scheduler.lastTickCompletedAt === null ||
      scheduler.lastTickStartedAt > scheduler.lastTickCompletedAt);

  const tickStallThresholdMs = healthFreshnessWindowMs;
  if (
    tickInFlight &&
    scheduler.lastTickStartedAt !== null &&
    now.getTime() - scheduler.lastTickStartedAt.getTime() > tickStallThresholdMs
  ) {
    return {
      status: 'UNHEALTHY',
      reason:
        'A scheduled tick has not completed within the expected interval.',
      providerStatus,
    };
  }

  if (scheduler.pending && scheduler.nextTickAt !== null) {
    if (
      scheduler.nextTickAt.getTime() + SIMULATION_HEALTH_RECENCY_WINDOW_MS <=
      now.getTime()
    ) {
      return {
        status: 'UNHEALTHY',
        reason: 'The next scheduled tick is overdue.',
        providerStatus,
      };
    }
  } else if (!scheduler.workExpected && scheduler.deadLetterCount === 0) {
    return {
      status: 'UNKNOWN',
      reason: 'No active scheduled work is expected right now.',
      providerStatus,
    };
  } else if (!tickInFlight && scheduler.lastTickCompletedAt === null) {
    return {
      status: 'UNHEALTHY',
      reason: 'Expected scheduled work has no pending tick.',
      providerStatus,
    };
  } else if (!tickInFlight) {
    return {
      status: 'DEGRADED',
      reason: 'Scheduler has stopped progressing and has no pending tick.',
      providerStatus,
    };
  }

  if (scheduler.deadLetterCount > 0) {
    return {
      status: 'DEGRADED',
      reason: `${scheduler.deadLetterCount} scheduler job${scheduler.deadLetterCount === 1 ? '' : 's'} failed permanently.`,
      providerStatus,
    };
  }

  if (providerStatus === 'DEGRADED') {
    return {
      status: 'DEGRADED',
      reason: 'Recent provider-backed executions have failed.',
      providerStatus,
    };
  }

  if (
    lastFailureAt !== null &&
    isRecent(lastFailureAt, now) &&
    (lastSuccessAt === null || lastFailureAt > lastSuccessAt)
  ) {
    return {
      status: 'DEGRADED',
      reason: 'Recent simulation executions have failed.',
      providerStatus,
    };
  }

  return { status: 'HEALTHY', reason: null, providerStatus };
}
