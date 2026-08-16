import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Injectable } from '@nestjs/common';

import {
  Prisma,
  SimulationExecutionSource,
  SimulationLog,
} from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationExecutionSource as DomainExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationTelemetryRecord } from '@/simulation/domain/simulation-telemetry';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import {
  SimulationLogCreateInput,
  SimulationLogFilters,
  SimulationLogRepository,
} from '@/simulation/logging/simulation-log-repository.interface';

/** The persisted enum stores the scheduler vocabulary in SCREAMING_SNAKE
 * (Prisma enum identifiers cannot carry hyphens); the domain carries the
 * lowercase transport values. */
const executionSourceToDb: Record<
  DomainExecutionSource,
  SimulationExecutionSource
> = {
  scheduled: 'SCHEDULED',
  'one-action': 'ONE_ACTION',
  custom: 'CUSTOM',
};

const executionSourceFromDb: Record<
  SimulationExecutionSource,
  DomainExecutionSource
> = {
  SCHEDULED: 'scheduled',
  ONE_ACTION: 'one-action',
  CUSTOM: 'custom',
};

@Injectable()
export class PrismaSimulationLogRepository extends SimulationLogRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async create(input: SimulationLogCreateInput): Promise<SimulationLogRecord> {
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
        errorMessage: input.errorMessage ?? null,
      },
    });

    return this.mapToRecord(row);
  }

  async findMany(input: {
    worldId: string;
    filters: SimulationLogFilters;
    page: number;
    limit: number;
  }): Promise<Paginated<SimulationLogRecord>> {
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
      items: rows.map((row) => this.mapToRecord(row)),
      meta: {
        page: input.page,
        limit: input.limit,
        total,
        totalPages: Math.ceil(total / input.limit),
      },
    };
  }

  async getTelemetry(
    worldId: string,
  ): Promise<SimulationTelemetryRecord | null> {
    const [aggregate, statusCounts] = await Promise.all([
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
    };
  }

  private mapToRecord(row: SimulationLog): SimulationLogRecord {
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
}
