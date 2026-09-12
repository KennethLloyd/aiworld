import {
  simulationIterationSchema,
  type ScheduledTurn,
  type SimulationIteration,
} from '@aiworld/shared/schemas/simulation-iteration.schema';
import { Injectable } from '@nestjs/common';

import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import {
  ActionFailure,
  SimulationActionError,
  toActionFailure,
} from '@/simulation/actions/simulation-action.error';
import {
  SimulationActionOutcome,
  SimulationDecision,
} from '@/simulation/actions/simulation-decision';
import { VoteAction } from '@/simulation/actions/vote.action';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import {
  SimulationLogEntry,
  SimulationLogService,
} from '@/simulation/logging/simulation-log.service';
import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import {
  isTransientSchedulerError,
  SimulationCharacterNotActiveError,
} from '@/simulation/scheduler/simulation-scheduler.error';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { WorldView, WorldService } from '@/world/world.service';

export type IterationRunResult =
  | {
      status: 'success';
      decision: SimulationDecision;
      log: SimulationLogEntry;
    }
  | { status: 'failed'; failure: ActionFailure; log: SimulationLogEntry };

export type ScheduledTurnRunResult =
  | IterationRunResult
  | { status: 'rejected'; reason: string; log: SimulationLogEntry };

type LogContext = {
  worldId: string;
  characterId: string;
  action: SimulationActionType;
  executionSource: SimulationExecutionSource;
  jobId?: string | null;
};
type ProviderMetadata = {
  provider: string;
  model: string;
};

/** Executes scheduled and manual Iterations through concrete Actions. */
@Injectable()
export class SimulationRunner {
  constructor(
    private readonly worldService: WorldService,
    private readonly lifecycleService: SimulationLifecycleService,
    private readonly picker: SimulationIterationPicker,
    private readonly postAction: PostAction,
    private readonly voteAction: VoteAction,
    private readonly commentAction: CommentAction,
    private readonly contentWriter: SimulationContentWriter,
    private readonly logService: SimulationLogService,
    private readonly provider: LlmProvider,
    private readonly narrativeService?: WorldNarrativeService,
  ) {}

  async runScheduledTurn(
    turn: ScheduledTurn,
    jobId?: string | null,
  ): Promise<ScheduledTurnRunResult> {
    const world = await this.requireWorld(turn.worldSlug);

    try {
      return await this.executeIteration({ world, iteration: turn, jobId });
    } catch (error) {
      // A missing World cannot be logged, so dead-letter the Turn.
      if (
        error instanceof SimulationActionError &&
        error.code === 'WORLD_NOT_FOUND'
      ) {
        throw error;
      }
      if (error instanceof SimulationWorkRejectedError) {
        const log = await this.logService.writeRejected({
          worldId: world.id,
          characterId: turn.characterId,
          action: turn.actionType,
          executionSource: turn.executionSource,
          ...this.providerMetadata(),
          reason: error.message,
          jobId,
        });
        return { status: 'rejected', reason: error.message, log };
      }
      if (error instanceof SimulationActionError) {
        return this.failScheduled(turn, world.id, jobId, error);
      }
      throw error;
    }
  }

  async runOneAction(worldSlug: string): Promise<IterationRunResult> {
    const iteration = await this.composeManualIteration(
      worldSlug,
      'one-action',
      {},
    );
    return this.runManualIteration(iteration);
  }

  async runCustomAction(input: {
    worldSlug: string;
    characterId?: string;
    actionType?: SimulationActionType;
  }): Promise<IterationRunResult> {
    const iteration = await this.composeManualIteration(
      input.worldSlug,
      'custom',
      input,
    );
    return this.runManualIteration(iteration);
  }

  async runManualIteration(
    iteration: SimulationIteration,
    jobId?: string | null,
  ): Promise<IterationRunResult> {
    const world = await this.requireWorld(iteration.worldSlug);
    return this.executeIteration({ world, iteration, jobId });
  }

  private async executeIteration(input: {
    world: WorldView;
    iteration: SimulationIteration;
    jobId?: string | null;
  }): Promise<IterationRunResult> {
    const { world, iteration, jobId } = input;
    await this.assertWorkAllowed(world.id, iteration.executionSource);
    const logContext: LogContext = {
      worldId: world.id,
      characterId: iteration.characterId,
      action: iteration.actionType,
      executionSource: iteration.executionSource,
      jobId,
    };

    if (iteration.actionType === 'POST') {
      return this.executeAction({
        logContext,
        worldSlug: iteration.worldSlug,
        runAction: () =>
          this.postAction.execute({
            worldSlug: iteration.worldSlug,
            characterId: iteration.characterId,
          }),
      });
    }

    const targetPostId = await this.picker.pickTargetPost(world.id);
    if (targetPostId === null) {
      const failure: ActionFailure = {
        code: 'NO_ACTIVE_TARGET',
        message: `No posts to ${iteration.actionType.toLowerCase()} in World "${world.slug}"`,
        retryable: false,
      };
      const log = await this.logService.writeFailure({
        ...logContext,
        ...this.providerMetadata(),
        failure,
      });
      return { status: 'failed', failure, log };
    }

    const runAction =
      iteration.actionType === 'VOTE'
        ? () =>
            this.voteAction.execute({
              worldSlug: iteration.worldSlug,
              characterId: iteration.characterId,
              postId: targetPostId,
            })
        : () =>
            this.commentAction.execute({
              worldSlug: iteration.worldSlug,
              characterId: iteration.characterId,
              postId: targetPostId,
            });

    return this.executeAction({
      logContext,
      worldSlug: iteration.worldSlug,
      runAction,
    });
  }

  private async executeAction(input: {
    logContext: LogContext;
    worldSlug: string;
    runAction: () => Promise<SimulationActionOutcome>;
  }): Promise<IterationRunResult> {
    await this.assertWorkAllowed(
      input.logContext.worldId,
      input.logContext.executionSource,
    );
    const outcome = await input.runAction();
    if (outcome.status === 'failed') {
      const log = await this.logService.writeFailure({
        ...input.logContext,
        ...this.providerMetadata(),
        failure: outcome.failure,
      });
      return { status: 'failed', failure: outcome.failure, log };
    }

    const decision = outcome.decision;
    await this.contentWriter.persist(decision);
    if (decision.action !== 'VOTE') {
      try {
        await this.narrativeService?.enqueue(decision.worldId);
      } catch {
        // A narrative provider or queue outage cannot undo saved content.
      }
    }
    const log = await this.logService.writeSuccess(
      decision,
      outcome.telemetry,
      input.logContext.executionSource,
      input.logContext.jobId,
    );
    return { status: 'success', decision, log };
  }

  private assertWorkAllowed(
    worldId: string,
    executionSource: SimulationIteration['executionSource'],
  ): Promise<SimulationConfig> {
    if (executionSource === 'scheduled') {
      return this.lifecycleService.assertScheduledWorkAllowed(worldId);
    }
    return this.lifecycleService.assertManualWorkAllowed(worldId);
  }

  private async composeManualIteration(
    worldSlug: string,
    executionSource: 'one-action' | 'custom',
    input: { characterId?: string; actionType?: SimulationActionType },
  ): Promise<SimulationIteration> {
    const world = await this.requireWorld(worldSlug);
    await this.lifecycleService.assertManualWorkAllowed(world.id);
    const config = await this.requireConfig(world.id);

    if (input.characterId) {
      const isActiveMember = await this.picker.findActiveActor(
        world.id,
        input.characterId,
      );
      if (!isActiveMember) {
        throw new SimulationCharacterNotActiveError(
          input.characterId,
          world.slug,
        );
      }
    }

    const characterId =
      input.characterId ??
      (await this.picker.pickCharacter(world.id)).characterId;
    const actionType =
      input.actionType ??
      (await this.picker.pickAutomaticAction(world.id, config.actionWeights));

    return simulationIterationSchema.parse({
      worldSlug: world.slug,
      characterId,
      actionType,
      executionSource,
      issuedAt: new Date().toISOString(),
    });
  }

  private async failScheduled(
    iteration: ScheduledTurn,
    worldId: string,
    jobId: string | null | undefined,
    error: unknown,
  ): Promise<ScheduledTurnRunResult> {
    const failure = toActionFailure(error);
    const retryableFailure = isTransientSchedulerError(error)
      ? { ...failure, retryable: true }
      : failure;
    const log = await this.logService.writeFailure({
      worldId,
      characterId: iteration.characterId,
      action: iteration.actionType,
      executionSource: iteration.executionSource,
      ...this.providerMetadata(),
      failure: retryableFailure,
      jobId,
    });
    return { status: 'failed', failure: retryableFailure, log };
  }

  private providerMetadata(): ProviderMetadata {
    return {
      provider: this.provider.config.providerId,
      model: this.provider.config.model,
    };
  }

  private async requireConfig(worldId: string): Promise<SimulationConfig> {
    const config = await this.lifecycleService.getByWorldId(worldId);
    if (!config) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `No simulation configuration for world "${worldId}"`,
      );
    }
    return config;
  }

  private async requireWorld(worldSlug: string): Promise<WorldView> {
    const world = await this.worldService.getBySlug(worldSlug, true);
    if (!world) {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${worldSlug}" was not found`,
      );
    }
    return world;
  }
}
