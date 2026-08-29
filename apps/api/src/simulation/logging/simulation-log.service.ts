import { Injectable } from '@nestjs/common';

import { ActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationDecision } from '@/simulation/actions/simulation-decision';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import {
  SimulationLogCreateInput,
  SimulationLogRepository,
} from '@/simulation/logging/simulation-log-repository.interface';
import { LlmProviderTelemetry } from '@/simulation/providers/llm-provider.port';

/** Translates action outcomes into SimulationLog rows. Logging stays separate
 * from actions and cost stays separate from logging: the estimator is injected
 * and only fills cost when the provider telemetry has none. */
@Injectable()
export class SimulationLogService {
  constructor(
    private readonly repository: SimulationLogRepository,
    private readonly costEstimator: SimulationCostEstimator,
  ) {}

  async writeSuccess(
    decision: SimulationDecision,
    telemetry: LlmProviderTelemetry,
    executionSource: SimulationExecutionSource,
    jobId?: string | null,
  ): Promise<SimulationLogRecord> {
    return this.repository.create({
      worldId: decision.worldId,
      characterId: decision.characterId,
      action: decision.action,
      targetId: this.targetIdFor(decision),
      reasoning: decision.reasoning,
      provider: telemetry.source,
      model: telemetry.model,
      latencyMs: telemetry.latencyMs,
      jobId: jobId ?? null,
      executionSource,
      tokensUsed: telemetry.tokens?.total ?? null,
      costEstimate:
        telemetry.costEstimateUsd ??
        this.costEstimator.estimateUsd(telemetry.tokens),
      status: this.statusFor(decision),
    });
  }

  async writeFailure(input: {
    worldId: string;
    characterId: string;
    action: SimulationDecision['action'];
    targetId?: string | null;
    executionSource: SimulationExecutionSource;
    provider: string;
    model: string;
    failure: ActionFailure;
    jobId?: string | null;
  }): Promise<SimulationLogRecord> {
    return this.repository.create({
      worldId: input.worldId,
      characterId: input.characterId,
      action: input.action,
      targetId: input.targetId ?? null,
      provider: input.provider,
      model: input.model,
      executionSource: input.executionSource,
      jobId: input.jobId ?? null,
      status: 'FAILED',
      errorMessage: `${input.failure.code}: ${input.failure.message}`,
      ...(input.failure.providerFailure === true
        ? { providerFailure: true }
        : {}),
    });
  }

  /** A lifecycle-gated tick that was refused (for example a scheduled tick
   * landing after the world left RUNNING). Rejection is not a failure — the
   * error is never retried — so it gets its own status. */
  async writeRejected(input: {
    worldId: string;
    characterId: string;
    action: SimulationDecision['action'];
    executionSource: SimulationExecutionSource;
    provider: string;
    model: string;
    reason: string;
    jobId?: string | null;
  }): Promise<SimulationLogRecord> {
    return this.repository.create({
      worldId: input.worldId,
      characterId: input.characterId,
      action: input.action,
      provider: input.provider,
      model: input.model,
      executionSource: input.executionSource,
      jobId: input.jobId ?? null,
      status: 'REJECTED',
      errorMessage: input.reason,
    });
  }

  private targetIdFor(decision: SimulationDecision): string | null {
    switch (decision.action) {
      case 'POST':
        return null;
      case 'VOTE':
        return decision.postId;
      case 'COMMENT':
        return decision.parentCommentId ?? decision.postId;
    }
  }

  private statusFor(
    decision: SimulationDecision,
  ): SimulationLogCreateInput['status'] {
    if (decision.action === 'VOTE' && decision.decision === 'skip') {
      return 'SKIPPED';
    }
    return 'SUCCESS';
  }
}
