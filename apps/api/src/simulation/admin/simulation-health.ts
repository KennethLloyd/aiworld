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
  const lastSuccessAt = telemetry.lastSuccessAt ?? null;
  const lastFailureAt = telemetry.lastFailureAt ?? null;
  const lastProviderSuccessAt =
    telemetry.lastProviderSuccessAt === undefined
      ? lastSuccessAt
      : telemetry.lastProviderSuccessAt;
  const lastProviderFailureAt =
    telemetry.lastProviderFailureAt === undefined
      ? lastFailureAt
      : telemetry.lastProviderFailureAt;
  const providerStatus: SimulationProviderHealthStatus =
    lastProviderFailureAt !== null &&
    (lastProviderSuccessAt === null ||
      lastProviderFailureAt > lastProviderSuccessAt)
      ? 'DEGRADED'
      : lastProviderSuccessAt !== null
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

  const tickInFlight =
    scheduler.lastTickStartedAt !== null &&
    (scheduler.lastTickCompletedAt === null ||
      scheduler.lastTickStartedAt > scheduler.lastTickCompletedAt);

  if (scheduler.pending && scheduler.nextTickAt !== null) {
    if (scheduler.nextTickAt <= now) {
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

  if (scheduler.retrying || scheduler.recentRetryCount > 0) {
    return {
      status: 'DEGRADED',
      reason: 'Scheduler retries are active or accumulating.',
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

  return { status: 'HEALTHY', reason: null, providerStatus };
}
