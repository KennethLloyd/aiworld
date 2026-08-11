import { Injectable } from '@nestjs/common';

import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import {
  ActionFailure,
  toActionFailure,
} from '@/simulation/actions/simulation-action.error';
import {
  SimulationActionOutcome,
  SimulationDecision,
} from '@/simulation/actions/simulation-decision';
import {
  SimulationCycleResult,
  SimulationCycleStepResult,
} from '@/simulation/cycle/simulation-cycle-result';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

type CycleMeta = {
  worldId: string;
  characterId: string;
  executionSource: SimulationExecutionSource;
  provider: string;
  model: string;
};

/** Runs a full mock cycle — POST, then VOTE, then COMMENT on the created
 * post — persisting valid decisions and logging every step. Invalid output,
 * provider failures, and write rejections become a logged FAILED step, never
 * a crash or a partial row. */
@Injectable()
export class SimulationCycleService {
  constructor(
    private readonly worldRepository: WorldRepository,
    private readonly executor: SimulationActionExecutor,
    private readonly writer: SimulationContentWriter,
    private readonly logService: SimulationLogService,
    private readonly provider: LlmProvider,
  ) {}

  async runCycle(input: {
    worldSlug: string;
    characterId: string;
    executionSource: SimulationExecutionSource;
  }): Promise<SimulationCycleResult> {
    const { worldSlug, characterId, executionSource } = input;

    const world = await this.worldRepository.findBySlug(worldSlug);
    if (!world) {
      return {
        status: 'failed',
        worldSlug,
        characterId,
        executionSource,
        failure: {
          code: 'WORLD_NOT_FOUND',
          message: `World "${worldSlug}" was not found`,
          retryable: false,
        },
        steps: [],
      };
    }

    const meta: CycleMeta = {
      worldId: world.id,
      characterId,
      executionSource,
      provider: this.provider.config.providerId,
      model: this.provider.config.model,
    };

    if (!world.isActive) {
      const failure: ActionFailure = {
        code: 'WORLD_NOT_FOUND',
        message: `World "${worldSlug}" is not active`,
        retryable: false,
      };
      const log = await this.logService.writeFailure({
        worldId: world.id,
        characterId,
        action: 'POST',
        executionSource,
        provider: meta.provider,
        model: meta.model,
        failure,
      });
      return {
        status: 'failed',
        worldSlug,
        characterId,
        executionSource,
        failure,
        steps: [{ step: 'POST', status: 'failed', failure, log }],
      };
    }

    const steps: SimulationCycleStepResult[] = [];

    const postOutcome = await this.executor.execute({
      action: 'POST',
      worldSlug,
      characterId,
    });
    const postStep = await this.handleOutcome(postOutcome, 'POST', null, meta);
    steps.push(postStep);
    if (postStep.status !== 'success' || postStep.step !== 'POST') {
      return this.finish(worldSlug, characterId, executionSource, steps);
    }

    const postId = postStep.targetId;
    const voteOutcome = await this.executor.execute({
      action: 'VOTE',
      worldSlug,
      characterId,
      postId,
    });
    steps.push(await this.handleOutcome(voteOutcome, 'VOTE', postId, meta));

    const commentOutcome = await this.executor.execute({
      action: 'COMMENT',
      worldSlug,
      characterId,
      postId,
    });
    steps.push(
      await this.handleOutcome(commentOutcome, 'COMMENT', postId, meta),
    );

    return this.finish(worldSlug, characterId, executionSource, steps);
  }

  private async handleOutcome(
    outcome: SimulationActionOutcome,
    action: SimulationDecision['action'],
    targetId: string | null,
    meta: CycleMeta,
  ): Promise<SimulationCycleStepResult> {
    if (outcome.status === 'failed') {
      const log = await this.logService.writeFailure({
        worldId: meta.worldId,
        characterId: meta.characterId,
        action,
        targetId,
        executionSource: meta.executionSource,
        provider: meta.provider,
        model: meta.model,
        failure: outcome.failure,
      });
      return { step: action, status: 'failed', failure: outcome.failure, log };
    }

    const decision = outcome.decision;
    try {
      const persisted = await this.writer.persist(decision);
      const skipped =
        decision.action === 'VOTE' && decision.decision === 'skip';
      if (persisted === null && !skipped) {
        throw new Error('Persisting a non-skipped decision produced no row');
      }

      const log = await this.logService.writeSuccess(
        decision,
        outcome.telemetry,
        meta.executionSource,
      );

      if (skipped) {
        return { step: 'VOTE', status: 'skipped', targetId: null, log };
      }
      return {
        step: decision.action,
        status: 'success',
        targetId: persisted!.id,
        log,
      };
    } catch (error) {
      const failure = toActionFailure(error);
      const log = await this.logService.writeFailure({
        worldId: meta.worldId,
        characterId: meta.characterId,
        action,
        targetId,
        executionSource: meta.executionSource,
        provider: meta.provider,
        model: meta.model,
        failure,
      });
      return { step: action, status: 'failed', failure, log };
    }
  }

  private finish(
    worldSlug: string,
    characterId: string,
    executionSource: SimulationExecutionSource,
    steps: SimulationCycleStepResult[],
  ): SimulationCycleResult {
    const failed = steps.find((step) => step.status === 'failed') as
      | (SimulationCycleStepResult & { failure: ActionFailure })
      | undefined;

    return {
      status: failed ? 'failed' : 'success',
      worldSlug,
      characterId,
      executionSource,
      failure: failed?.failure ?? null,
      steps,
    };
  }
}
