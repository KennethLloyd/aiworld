import { Injectable } from '@nestjs/common';

import {
  SimulationExecutionSource,
  SimulationLog,
} from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationExecutionSource as DomainExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import {
  SimulationLogCreateInput,
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
