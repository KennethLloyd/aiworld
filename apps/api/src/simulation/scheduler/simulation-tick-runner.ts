import { SimulationCommand as ScheduledCommand } from '@aiworld/shared/schemas/simulation-command.schema';
import { Injectable } from '@nestjs/common';

import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { SimulationActionType } from '@/simulation/actions/simulation-action-type';
import {
  ActionFailure,
  SimulationActionError,
  toActionFailure,
} from '@/simulation/actions/simulation-action.error';
import { SimulationCommand } from '@/simulation/actions/simulation-command';
import { SimulationDecision } from '@/simulation/actions/simulation-decision';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { isTransientSchedulerError } from '@/simulation/scheduler/simulation-scheduler.error';
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

/** Executes one iteration of simulated work — the shared body of scheduled
 * ticks, Run One Action, and Custom Action. Every operation hands the runner a
 * serializable `SimulationCommand` (the same shape both queue adapters
 * transport) and receives a result: success, a logged failure, or a lifecycle
 * rejection. The runner enforces World activity and the lifecycle gates
 * (scheduled work only while RUNNING, manual work rejected in HALTED), resolves
 * VOTE/COMMENT target posts, and funnels every outcome through the action
 * executor → content writer → log service pipeline. Thrown errors are turned
 * into logged failures here — transient ones stay retryable so the adapter's
 * policy applies — and the runner never talks to a queue or an LLM provider
 * directly. */
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
    command: ScheduledCommand,
    jobId?: string | null,
  ): Promise<ScheduledTickRunResult> {
    // A tick whose World vanished (deleted between enqueue and processing)
    // throws here: there is no worldId to attach a SimulationLog row to, so
    // the DLQ is the record and the job never retries the identical command.
    const world = await this.requireWorld(command.worldSlug);

    try {
      return await this.executeIteration({ world, command, jobId });
    } catch (error) {
      if (
        error instanceof SimulationActionError &&
        error.code === 'WORLD_NOT_FOUND'
      ) {
        throw error;
      }
      if (error instanceof SimulationWorkRejectedError) {
        const log = await this.logService.writeRejected({
          worldId: world.id,
          characterId: command.characterId,
          action: command.actionType,
          executionSource: command.executionSource,
          ...this.providerMetadata(),
          reason: error.message,
          jobId,
        });
        return { status: 'rejected', reason: error.message, log };
      }
      return this.failScheduled(command, world.id, jobId, error);
    }
  }

  /** Manual work (Run One Action / Custom Action) awaits the result. A
   * HALTED or inactive World throws instead of executing. */
  async runManualIteration(
    command: ScheduledCommand,
    jobId?: string | null,
  ): Promise<IterationRunResult> {
    const world = await this.requireWorld(command.worldSlug);
    return this.executeIteration({ world, command, jobId });
  }

  private async executeIteration(input: {
    world: WorldRecord;
    command: ScheduledCommand;
    jobId?: string | null;
  }): Promise<IterationRunResult> {
    const { world, command, jobId } = input;
    await this.assertWorkAllowed(world.id, command.executionSource);
    const workKind =
      command.executionSource === 'scheduled' ? 'SCHEDULED' : 'MANUAL';
    const logContext: LogContext = {
      worldId: world.id,
      characterId: command.characterId,
      action: command.actionType,
      executionSource: command.executionSource,
      jobId,
    };

    if (command.actionType === 'POST') {
      return this.executeExecutorCommand({
        logContext,
        executorCommand: {
          action: 'POST',
          worldSlug: command.worldSlug,
          characterId: command.characterId,
        },
        workKind,
      });
    }

    // VOTE/COMMENT need a target post; without one the action cannot proceed
    // and fails permanently (never retried). A forced action on an empty World
    // is the one path that legitimately reaches this.
    const targetPostId = await this.picker.pickTargetPost(world.id);
    if (targetPostId === null) {
      const failure: ActionFailure = {
        code: 'NO_ACTIVE_TARGET',
        message: `No posts to ${command.actionType.toLowerCase()} in World "${world.slug}"`,
        retryable: false,
      };
      const log = await this.logService.writeFailure({
        ...logContext,
        ...this.providerMetadata(),
        failure,
      });
      return { status: 'failed', failure, log };
    }

    return this.executeExecutorCommand({
      logContext,
      executorCommand: {
        action: command.actionType,
        worldSlug: command.worldSlug,
        characterId: command.characterId,
        postId: targetPostId,
      },
      workKind,
    });
  }

  private async executeExecutorCommand(input: {
    logContext: LogContext;
    executorCommand: SimulationCommand;
    workKind: 'MANUAL' | 'SCHEDULED';
  }): Promise<IterationRunResult> {
    const allowedConfig = await this.assertWorkAllowed(
      input.logContext.worldId,
      input.logContext.executionSource,
    );
    const outcome = await this.executor.execute(input.executorCommand);
    if (outcome.status === 'failed') {
      const log = await this.logService.writeFailure({
        ...input.logContext,
        ...this.providerMetadata(),
        failure: outcome.failure,
      });
      return { status: 'failed', failure: outcome.failure, log };
    }

    const decision = outcome.decision;
    // The provider may finish while deactivation is in flight. Serialize the
    // final write with deactivation so inactive Worlds cannot gain new content.
    const persisted = await this.worldRepository.withActiveSimulationLock(
      input.logContext.worldId,
      async () => {
        await this.assertWorkAllowed(
          input.logContext.worldId,
          input.logContext.executionSource,
        );
        await this.contentWriter.persist(decision);
      },
    );
    if (persisted.status === 'inactive') {
      throw new SimulationWorkRejectedError(
        input.workKind,
        allowedConfig.state,
        'INACTIVE',
      );
    }
    if (persisted.status === 'missing') {
      throw new SimulationActionError(
        'WORLD_NOT_FOUND',
        `World "${input.executorCommand.worldSlug}" was not found`,
      );
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
    executionSource: ScheduledCommand['executionSource'],
  ): Promise<WorldSimulationConfigRecord> {
    if (executionSource === 'scheduled') {
      return this.lifecycleService.assertScheduledWorkAllowed(worldId);
    }
    return this.lifecycleService.assertManualWorkAllowed(worldId);
  }

  /** Converts a thrown error into a logged failed result so every attempt
   * lands in SimulationLog. Transient errors (LLM timeouts, 5xx, rate limits,
   * database connection blips) keep `retryable: true` so the adapter applies
   * its backoff policy; permanent errors never retry. */
  private async failScheduled(
    command: ScheduledCommand,
    worldId: string,
    jobId: string | null | undefined,
    error: unknown,
  ): Promise<ScheduledTickRunResult> {
    const failure = toActionFailure(error);
    const retryableFailure = isTransientSchedulerError(error)
      ? { ...failure, retryable: true }
      : failure;
    const log = await this.logService.writeFailure({
      worldId,
      characterId: command.characterId,
      action: command.actionType,
      executionSource: command.executionSource,
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
