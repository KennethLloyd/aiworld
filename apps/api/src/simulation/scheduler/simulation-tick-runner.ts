import { Injectable } from '@nestjs/common';

import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import {
  ActionFailure,
  SimulationActionError,
} from '@/simulation/actions/simulation-action.error';
import { SimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationDecision } from '@/simulation/actions/simulation-decision';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

export type IterationRunResult =
  | {
      status: 'success';
      decision: SimulationDecision;
      log: SimulationLogRecord;
    }
  | { status: 'failed'; failure: ActionFailure; log: SimulationLogRecord };

export type ScheduledTickRunResult =
  | IterationRunResult
  | { status: 'rejected'; reason: string; log: SimulationLogRecord };

export type ScheduledTickInput = {
  worldSlug: string;
  characterId: string;
  actionType: SimulationActionType;
  executionSource: SimulationExecutionSource;
  jobId?: string | null;
};

export type ManualIterationInput = {
  worldSlug: string;
  characterId?: string;
  actionType?: SimulationActionType;
  executionSource: SimulationExecutionSource;
  jobId?: string | null;
};

/** Executes one iteration of simulated work — the shared body of scheduled
 * ticks, Run One Action, and Custom Action. The runner enforces the lifecycle
 * gates (scheduled work only while RUNNING, manual work rejected in HALTED),
 * composes the same serializable command shape as every other source, and
 * funnels every outcome through the action executor → content writer → log
 * service pipeline. It never talks to a queue or an LLM provider directly. */
@Injectable()
export class SimulationTickRunner {
  constructor(
    private readonly worldRepository: WorldRepository,
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly picker: SimulationIterationPicker,
    private readonly executor: SimulationActionExecutor,
    private readonly contentWriter: SimulationContentWriter,
    private readonly logService: SimulationLogService,
    private readonly provider: LlmProvider,
  ) {}

  async runScheduledTick(
    input: ScheduledTickInput,
  ): Promise<ScheduledTickRunResult> {
    const world = await this.requireWorld(input.worldSlug);

    try {
      await this.lifecycleService.assertScheduledWorkAllowed(world.id);
    } catch (error) {
      if (error instanceof SimulationWorkRejectedError) {
        const log = await this.logService.writeRejected({
          worldId: world.id,
          characterId: input.characterId,
          action: input.actionType,
          executionSource: input.executionSource,
          provider: this.provider.config.providerId,
          model: this.provider.config.model,
          reason: error.message,
          jobId: input.jobId,
        });
        return { status: 'rejected', reason: error.message, log };
      }
      throw error;
    }

    return this.executeIteration({
      world,
      characterId: input.characterId,
      actionType: input.actionType,
      executionSource: input.executionSource,
      jobId: input.jobId,
    });
  }

  /** Manual work (Run One Action / Custom Action) awaits the result. Missing
   * character (Any Resident) and missing action (Automatic) are composed
   * through the picker; a HALTED world throws instead of executing. */
  async runManualIteration(
    input: ManualIterationInput,
  ): Promise<IterationRunResult> {
    const world = await this.requireWorld(input.worldSlug);
    const config = await this.lifecycleService.assertManualWorkAllowed(
      world.id,
    );

    const characterId =
      input.characterId ??
      (await this.picker.pickCharacter(world.id)).characterId;
    const actionType =
      input.actionType ?? this.picker.pickAction(config.actionWeights);

    return this.executeIteration({
      world,
      characterId,
      actionType,
      executionSource: input.executionSource,
      jobId: input.jobId,
    });
  }

  private async executeIteration(input: {
    world: WorldRecord;
    characterId: string;
    actionType: SimulationActionType;
    executionSource: SimulationExecutionSource;
    jobId?: string | null;
  }): Promise<IterationRunResult> {
    const targetPostId =
      input.actionType === 'POST'
        ? null
        : await this.picker.pickTargetPost(input.world.id);

    if (targetPostId === null && input.actionType !== 'POST') {
      const failure: ActionFailure = {
        code: 'NO_ACTIVE_TARGET',
        message: `No posts to ${input.actionType.toLowerCase()} in World "${input.world.slug}"`,
        retryable: false,
      };
      const log = await this.logService.writeFailure({
        worldId: input.world.id,
        characterId: input.characterId,
        action: input.actionType,
        executionSource: input.executionSource,
        provider: this.provider.config.providerId,
        model: this.provider.config.model,
        failure,
        jobId: input.jobId,
      });
      return { status: 'failed', failure, log };
    }

    const command = this.toExecutorCommand({
      worldSlug: input.world.slug,
      characterId: input.characterId,
      actionType: input.actionType,
      // The guard above guarantees a target for VOTE/COMMENT.
      targetPostId: targetPostId as string,
    });

    const outcome = await this.executor.execute(command);
    if (outcome.status === 'failed') {
      const log = await this.logService.writeFailure({
        worldId: input.world.id,
        characterId: input.characterId,
        action: input.actionType,
        executionSource: input.executionSource,
        provider: this.provider.config.providerId,
        model: this.provider.config.model,
        failure: outcome.failure,
        jobId: input.jobId,
      });
      return { status: 'failed', failure: outcome.failure, log };
    }

    const decision = outcome.decision;
    await this.contentWriter.persist(decision);
    const log = await this.logService.writeSuccess(
      decision,
      outcome.telemetry,
      input.executionSource,
      input.jobId,
    );
    return { status: 'success', decision, log };
  }

  private toExecutorCommand(input: {
    worldSlug: string;
    characterId: string;
    actionType: SimulationActionType;
    targetPostId: string | null;
  }): SimulationCommand {
    switch (input.actionType) {
      case 'POST':
        return {
          action: 'POST',
          worldSlug: input.worldSlug,
          characterId: input.characterId,
        };
      case 'VOTE':
        return {
          action: 'VOTE',
          worldSlug: input.worldSlug,
          characterId: input.characterId,
          postId: input.targetPostId ?? '',
        };
      case 'COMMENT':
        return {
          action: 'COMMENT',
          worldSlug: input.worldSlug,
          characterId: input.characterId,
          postId: input.targetPostId ?? '',
        };
    }
  }

  private async requireWorld(worldSlug: string): Promise<WorldRecord> {
    const world = await this.worldRepository.findBySlug(worldSlug);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldSlug}" was not found`,
      );
    }
    return world;
  }
}
