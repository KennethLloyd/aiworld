import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import {
  Prisma,
  SimulationLog,
  type SimulationExecutionSource as PrismaSimulationExecutionSource,
} from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import { ActionFailure } from '@/simulation/actions/simulation-action.error';
import { SimulationDecision } from '@/simulation/actions/simulation-decision';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';
import {
  SimulationExecutionSource,
  SimulationLogStatus,
} from '@/simulation/domain/simulation-log';
import { SimulationTelemetry } from '@/simulation/domain/simulation-telemetry';
import { LlmProviderTelemetry } from '@/simulation/providers/llm-provider.port';

export type SimulationLogEntry = {
  id: string;
  worldId: string;
  characterId: string;
  action: SimulationActionType;
  targetId: string | null;
  reasoning: string | null;
  provider: string;
  model: string;
  latencyMs: number | null;
  jobId: string | null;
  executionSource: SimulationExecutionSource;
  tokensUsed: number | null;
  costEstimate: number | null;
  status: SimulationLogStatus;
  errorMessage: string | null;
  executedAt: Date;
};

export type SimulationLogFilters = {
  characterId?: string;
  action?: SimulationActionType;
  status?: SimulationLogStatus;
  executionSource?: SimulationExecutionSource;
};

export type SimulationLogCreateInput = {
  worldId: string;
  characterId: string;
  action: SimulationActionType;
  targetId?: string | null;
  reasoning?: string | null;
  provider: string;
  model: string;
  latencyMs?: number | null;
  jobId?: string | null;
  executionSource: SimulationExecutionSource;
  tokensUsed?: number | null;
  costEstimate?: number | null;
  providerFailure?: boolean;
  status: SimulationLogStatus;
  errorMessage?: string | null;
};

const executionSourceToDb: Record<
  SimulationExecutionSource,
  PrismaSimulationExecutionSource
> = {
  scheduled: 'SCHEDULED',
  'one-action': 'ONE_ACTION',
  custom: 'CUSTOM',
};

const executionSourceFromDb: Record<
  PrismaSimulationExecutionSource,
  SimulationExecutionSource
> = {
  SCHEDULED: 'scheduled',
  ONE_ACTION: 'one-action',
  CUSTOM: 'custom',
};

@Injectable()
export class SimulationLogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly costEstimator: SimulationCostEstimator,
  ) {}

  async writeSuccess(
    decision: SimulationDecision,
    telemetry: LlmProviderTelemetry,
    executionSource: SimulationExecutionSource,
    jobId?: string | null,
  ): Promise<SimulationLogEntry> {
    return this.create({
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
  }): Promise<SimulationLogEntry> {
    return this.create({
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

  async writeRejected(input: {
    worldId: string;
    characterId: string;
    action: SimulationDecision['action'];
    executionSource: SimulationExecutionSource;
    provider: string;
    model: string;
    reason: string;
    jobId?: string | null;
  }): Promise<SimulationLogEntry> {
    return this.create({
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

  async list(input: {
    worldId: string;
    filters: SimulationLogFilters;
    page: number;
    limit: number;
  }): Promise<Paginated<SimulationLogEntry>> {
    const where: Prisma.SimulationLogWhereInput = {
      worldId: input.worldId,
      ...(input.filters.characterId
        ? { characterId: input.filters.characterId }
        : {}),
      ...(input.filters.action ? { action: input.filters.action } : {}),
      ...(input.filters.status ? { status: input.filters.status } : {}),
      ...(input.filters.executionSource
        ? {
            executionSource: executionSourceToDb[input.filters.executionSource],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.simulationLog.findMany({
        where,
        orderBy: { executedAt: 'desc' },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.simulationLog.count({ where }),
    ]);
    return {
      items: rows.map(mapSimulationLog),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async getTelemetry(worldId: string): Promise<SimulationTelemetry | null> {
    const [
      aggregate,
      statusCounts,
      lastSuccess,
      lastProviderSuccess,
      lastFailure,
      lastProviderFailure,
    ] = await Promise.all([
      this.prisma.simulationLog.aggregate({
        where: { worldId },
        _count: { id: true },
        _sum: { tokensUsed: true, costEstimate: true },
        _avg: { latencyMs: true },
        _max: { executedAt: true },
      }),
      this.prisma.simulationLog.groupBy({
        by: ['status'],
        where: { worldId },
        _count: { status: true },
      }),
      this.prisma.simulationLog.findFirst({
        where: { worldId, status: 'SUCCESS' },
        orderBy: { executedAt: 'desc' },
        select: { executedAt: true },
      }),
      this.prisma.simulationLog.findFirst({
        where: { worldId, status: { in: ['SUCCESS', 'SKIPPED'] } },
        orderBy: { executedAt: 'desc' },
        select: { executedAt: true },
      }),
      this.prisma.simulationLog.findFirst({
        where: { worldId, status: 'FAILED' },
        orderBy: { executedAt: 'desc' },
        select: { executedAt: true },
      }),
      this.prisma.simulationLog.findFirst({
        where: { worldId, status: 'FAILED', providerFailure: true },
        orderBy: { executedAt: 'desc' },
        select: { executedAt: true },
      }),
    ]);

    if (aggregate._count.id === 0) {
      return null;
    }
    const statusCount = (status: string): number =>
      statusCounts.find((row) => row.status === status)?._count.status ?? 0;
    return {
      worldId,
      totalRuns: aggregate._count.id,
      successCount: statusCount('SUCCESS'),
      failedCount: statusCount('FAILED'),
      skippedCount: statusCount('SKIPPED'),
      rejectedCount: statusCount('REJECTED'),
      totalTokensUsed: aggregate._sum.tokensUsed,
      totalCostEstimateUsd:
        aggregate._sum.costEstimate === null
          ? null
          : Number(aggregate._sum.costEstimate),
      averageLatencyMs:
        aggregate._avg.latencyMs === null
          ? null
          : Math.round(aggregate._avg.latencyMs),
      lastRunAt: aggregate._max.executedAt,
      lastSuccessAt: lastSuccess?.executedAt ?? null,
      lastProviderSuccessAt: lastProviderSuccess?.executedAt ?? null,
      lastFailureAt: lastFailure?.executedAt ?? null,
      lastProviderFailureAt: lastProviderFailure?.executedAt ?? null,
    };
  }

  private async create(
    input: SimulationLogCreateInput,
  ): Promise<SimulationLogEntry> {
    const row = await this.prisma.simulationLog.create({
      data: {
        worldId: input.worldId,
        characterId: input.characterId,
        action: input.action,
        targetId: input.targetId ?? null,
        reasoning: input.reasoning ?? null,
        provider: input.provider,
        model: input.model,
        latencyMs: input.latencyMs ?? null,
        jobId: input.jobId ?? null,
        executionSource: executionSourceToDb[input.executionSource],
        tokensUsed: input.tokensUsed ?? null,
        costEstimate: input.costEstimate ?? null,
        status: input.status,
        providerFailure: input.providerFailure ?? false,
        errorMessage: input.errorMessage ?? null,
      },
    });
    return mapSimulationLog(row);
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

  private statusFor(decision: SimulationDecision): SimulationLogStatus {
    return decision.action === 'VOTE' && decision.decision === 'skip'
      ? 'SKIPPED'
      : 'SUCCESS';
  }
}

function mapSimulationLog(row: SimulationLog): SimulationLogEntry {
  return {
    id: row.id,
    worldId: row.worldId,
    characterId: row.characterId,
    action: row.action,
    targetId: row.targetId,
    reasoning: row.reasoning,
    provider: row.provider,
    model: row.model,
    latencyMs: row.latencyMs,
    jobId: row.jobId,
    executionSource: executionSourceFromDb[row.executionSource],
    tokensUsed: row.tokensUsed,
    costEstimate: row.costEstimate === null ? null : Number(row.costEstimate),
    status: row.status,
    errorMessage: row.errorMessage,
    executedAt: row.executedAt,
  };
}
