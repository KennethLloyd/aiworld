import type { SimulationBlockedReason } from '@aiworld/shared/schemas/simulation-health.schema';
import { Injectable } from '@nestjs/common';

import {
  Prisma,
  SimulationRuntimeState as PrismaRuntimeState,
} from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import {
  RECENT_RETRY_WINDOW_MS,
  SimulationRuntimeSignals,
} from '@/simulation/scheduler/simulation-runtime-signals';

export type SimulationRuntimeState = SimulationRuntimeSignals & {
  worldId: string;
  lastRetryAt: Date | null;
};

export type SimulationRuntimeStateUpdate = Partial<
  Omit<SimulationRuntimeState, 'worldId'>
>;

@Injectable()
export class SimulationRuntimeStateService {
  constructor(private readonly prisma: PrismaService) {}

  async findByWorldId(worldId: string): Promise<SimulationRuntimeState | null> {
    const row = await this.prisma.simulationRuntimeState.findUnique({
      where: { worldId },
    });
    return row ? mapRuntimeState(row) : null;
  }

  async update(
    worldId: string,
    input: SimulationRuntimeStateUpdate,
  ): Promise<void> {
    const updateData: Prisma.SimulationRuntimeStateUncheckedUpdateInput = {};
    if (input.pending !== undefined) updateData.pending = input.pending;
    if (input.workExpected !== undefined)
      updateData.workExpected = input.workExpected;
    if (input.nextTurnAt !== undefined)
      updateData.nextTurnAt = input.nextTurnAt;
    if (input.lastTurnStartedAt !== undefined) {
      updateData.lastTurnStartedAt = input.lastTurnStartedAt;
    }
    if (input.lastTurnCompletedAt !== undefined) {
      updateData.lastTurnCompletedAt = input.lastTurnCompletedAt;
    }
    if (input.retrying !== undefined) updateData.retrying = input.retrying;
    if (input.recentRetryCount !== undefined) {
      updateData.recentRetryCount = input.recentRetryCount;
    }
    if (input.blockedReason !== undefined)
      updateData.blockedReason = input.blockedReason;
    if (input.lastRetryAt !== undefined)
      updateData.lastRetryAt = input.lastRetryAt;
    if (input.deadLetterCount !== undefined)
      updateData.deadLetterCount = input.deadLetterCount;
    if (input.lastDeadLetterAt !== undefined) {
      updateData.lastDeadLetterAt = input.lastDeadLetterAt;
    }
    if (input.lastDeadLetterReason !== undefined) {
      updateData.lastDeadLetterReason = input.lastDeadLetterReason;
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
        nextTurnAt: input.nextTurnAt ?? null,
        lastTurnStartedAt: input.lastTurnStartedAt ?? null,
        lastTurnCompletedAt: input.lastTurnCompletedAt ?? null,
        retrying: input.retrying ?? false,
        recentRetryCount: input.recentRetryCount ?? 0,
        lastRetryAt: input.lastRetryAt ?? null,
        blockedReason: input.blockedReason ?? null,
        deadLetterCount: input.deadLetterCount ?? 0,
        lastDeadLetterAt: input.lastDeadLetterAt ?? null,
        lastDeadLetterReason: input.lastDeadLetterReason ?? null,
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

  async recordDeadLetter(
    worldId: string,
    occurredAt: Date,
    reason: string,
  ): Promise<void> {
    await this.prisma.simulationRuntimeState.upsert({
      where: { worldId },
      create: {
        worldId,
        deadLetterCount: 1,
        lastDeadLetterAt: occurredAt,
        lastDeadLetterReason: reason,
      },
      update: {
        deadLetterCount: { increment: 1 },
        lastDeadLetterAt: occurredAt,
        lastDeadLetterReason: reason,
      },
    });
  }
}

function mapRuntimeState(row: PrismaRuntimeState): SimulationRuntimeState {
  return {
    worldId: row.worldId,
    pending: row.pending,
    workExpected: row.workExpected,
    nextTurnAt: row.nextTurnAt,
    lastTurnStartedAt: row.lastTurnStartedAt,
    lastTurnCompletedAt: row.lastTurnCompletedAt,
    retrying: row.retrying,
    recentRetryCount: row.recentRetryCount,
    lastRetryAt: row.lastRetryAt,
    blockedReason: row.blockedReason as SimulationBlockedReason | null,
    deadLetterCount: row.deadLetterCount,
    lastDeadLetterAt: row.lastDeadLetterAt,
    lastDeadLetterReason: row.lastDeadLetterReason,
    bootResumeFailure:
      row.bootResumeFailureAt === null || row.bootResumeFailureReason === null
        ? null
        : {
            occurredAt: row.bootResumeFailureAt,
            reason: row.bootResumeFailureReason,
          },
  };
}
