import { Injectable } from '@nestjs/common';

import { Prisma, SimulationRuntimeState } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import {
  SimulationRuntimeStateRecord,
  SimulationRuntimeStateRepository,
  SimulationRuntimeStateUpdate,
} from '@/simulation/scheduler/simulation-runtime-state-repository.interface';

const RECENT_RETRY_WINDOW_MS = 15 * 60 * 1_000;

@Injectable()
export class PrismaSimulationRuntimeStateRepository extends SimulationRuntimeStateRepository {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async findByWorldId(
    worldId: string,
  ): Promise<SimulationRuntimeStateRecord | null> {
    const row = await this.prisma.simulationRuntimeState.findUnique({
      where: { worldId },
    });
    return row === null ? null : this.mapToRecord(row);
  }

  async update(
    worldId: string,
    input: SimulationRuntimeStateUpdate,
  ): Promise<void> {
    const updateData: Prisma.SimulationRuntimeStateUncheckedUpdateInput = {};
    if (input.pending !== undefined) updateData.pending = input.pending;
    if (input.workExpected !== undefined) {
      updateData.workExpected = input.workExpected;
    }
    if (input.nextTickAt !== undefined) {
      updateData.nextTickAt = input.nextTickAt;
    }
    if (input.lastTickStartedAt !== undefined) {
      updateData.lastTickStartedAt = input.lastTickStartedAt;
    }
    if (input.lastTickCompletedAt !== undefined) {
      updateData.lastTickCompletedAt = input.lastTickCompletedAt;
    }
    if (input.retrying !== undefined) updateData.retrying = input.retrying;
    if (input.recentRetryCount !== undefined) {
      updateData.recentRetryCount = input.recentRetryCount;
    }
    if (input.lastRetryAt !== undefined) {
      updateData.lastRetryAt = input.lastRetryAt;
    }
    if (input.bootResumeFailure !== undefined) {
      updateData.bootResumeFailureAt =
        input.bootResumeFailure === null
          ? null
          : input.bootResumeFailure.occurredAt;
      updateData.bootResumeFailureReason =
        input.bootResumeFailure === null
          ? null
          : input.bootResumeFailure.reason;
    }

    await this.prisma.simulationRuntimeState.upsert({
      where: { worldId },
      create: {
        worldId,
        pending: input.pending ?? false,
        workExpected: input.workExpected ?? false,
        nextTickAt: input.nextTickAt ?? null,
        lastTickStartedAt: input.lastTickStartedAt ?? null,
        lastTickCompletedAt: input.lastTickCompletedAt ?? null,
        retrying: input.retrying ?? false,
        recentRetryCount: input.recentRetryCount ?? 0,
        lastRetryAt: input.lastRetryAt ?? null,
        bootResumeFailureAt: input.bootResumeFailure?.occurredAt ?? null,
        bootResumeFailureReason: input.bootResumeFailure?.reason ?? null,
      },
      update: updateData,
    });
  }

  async recordRetry(worldId: string): Promise<void> {
    const now = new Date();
    const current = await this.findByWorldId(worldId);
    const hasRecentRetry =
      current?.lastRetryAt !== null &&
      current?.lastRetryAt !== undefined &&
      now.getTime() - current.lastRetryAt.getTime() < RECENT_RETRY_WINDOW_MS;

    await this.update(worldId, {
      retrying: true,
      recentRetryCount: hasRecentRetry
        ? (current?.recentRetryCount ?? 0) + 1
        : 1,
      lastRetryAt: now,
    });
  }

  private mapToRecord(
    row: SimulationRuntimeState,
  ): SimulationRuntimeStateRecord {
    return {
      worldId: row.worldId,
      pending: row.pending,
      workExpected: row.workExpected,
      nextTickAt: row.nextTickAt,
      lastTickStartedAt: row.lastTickStartedAt,
      lastTickCompletedAt: row.lastTickCompletedAt,
      retrying: row.retrying,
      recentRetryCount: row.recentRetryCount,
      lastRetryAt: row.lastRetryAt,
      bootResumeFailure:
        row.bootResumeFailureAt === null || row.bootResumeFailureReason === null
          ? null
          : {
              occurredAt: row.bootResumeFailureAt,
              reason: row.bootResumeFailureReason,
            },
    };
  }
}
