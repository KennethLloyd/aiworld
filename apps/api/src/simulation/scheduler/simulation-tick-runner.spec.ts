import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { PostDecision } from '@/simulation/actions/simulation-decision';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import { SimulationWorkRejectedError } from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationTickRunner } from '@/simulation/scheduler/simulation-tick-runner';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

const world: WorldRecord = {
  id: 'world-1',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: null,
  rules: [],
  topicScope: 'MBTI',
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const config: WorldSimulationConfigRecord = {
  id: 'config-1',
  worldId: 'world-1',
  state: 'RUNNING',
  speedMultiplier: 1,
  intervalMs: 1800000,
  jitterMs: 300000,
  actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
  providerId: 'mock',
  model: 'fixture-model',
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const postDecision: PostDecision = {
  action: 'POST',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  title: 'A new post',
  content: 'Body.',
  reasoning: 'Reasoning.',
};

function createRunner(
  overrides: {
    gateState?: 'scheduled' | 'manual' | 'halted';
  } = {},
) {
  const worldRepository = {
    findBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as jest.Mocked<WorldRepository>;

  const lifecycleService = {
    assertScheduledWorkAllowed: jest.fn(),
    assertManualWorkAllowed: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<
      SimulationLifecycleService,
      'assertScheduledWorkAllowed' | 'assertManualWorkAllowed'
    >
  >;

  const state = overrides.gateState ?? 'scheduled';
  if (state === 'halted') {
    lifecycleService.assertScheduledWorkAllowed.mockRejectedValue(
      new SimulationWorkRejectedError('SCHEDULED', 'HALTED'),
    );
    lifecycleService.assertManualWorkAllowed.mockRejectedValue(
      new SimulationWorkRejectedError('MANUAL', 'HALTED'),
    );
  } else {
    lifecycleService.assertScheduledWorkAllowed.mockResolvedValue(config);
    lifecycleService.assertManualWorkAllowed.mockResolvedValue(config);
  }

  const picker = {
    pickCharacter: jest.fn().mockResolvedValue({
      characterId: 'character-1',
      memberId: 'member-1',
    }),
    pickAction: jest.fn().mockReturnValue('POST'),
    pickTargetPost: jest.fn().mockResolvedValue('post-1'),
  } as unknown as jest.Mocked<SimulationIterationPicker>;

  const executor = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<SimulationActionExecutor>;

  const contentWriter = {
    persist: jest.fn().mockResolvedValue({ id: 'post-9' }),
  } as unknown as jest.Mocked<SimulationContentWriter>;

  const logService = {
    writeSuccess: jest.fn(),
    writeFailure: jest.fn(),
    writeRejected: jest.fn(),
  } as unknown as jest.Mocked<SimulationLogService>;

  const provider = {
    config: { providerId: 'mock', model: 'fixture-model' },
  } as unknown as LlmProvider;

  const runner = new SimulationTickRunner(
    worldRepository,
    lifecycleService as never,
    picker,
    executor,
    contentWriter,
    logService,
    provider,
  );

  return {
    runner,
    worldRepository,
    lifecycleService,
    picker,
    executor,
    contentWriter,
    logService,
  };
}

const successOutcome = {
  status: 'success' as const,
  decision: postDecision,
  telemetry: {
    source: 'mock',
    model: 'fixture-model',
    latencyMs: 7,
    tokens: { prompt: 10, completion: 5, total: 15 },
  },
};

describe('SimulationTickRunner', () => {
  describe('runScheduledTick', () => {
    it('gates scheduled work, executes the fixed command, persists, and logs', async () => {
      const { runner, lifecycleService, executor, contentWriter, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      logService.writeSuccess.mockResolvedValue({ id: 'log-1' });

      const result = await runner.runScheduledTick({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'scheduled',
        jobId: 'job-1',
      });

      expect(lifecycleService.assertScheduledWorkAllowed).toHaveBeenCalledWith(
        'world-1',
      );
      expect(executor.execute).toHaveBeenCalledWith({
        action: 'POST',
        worldSlug: 'mbti-house',
        characterId: 'character-1',
      });
      expect(contentWriter.persist).toHaveBeenCalledWith(postDecision);
      expect(logService.writeSuccess).toHaveBeenCalledWith(
        postDecision,
        expect.objectContaining({ source: 'mock' }),
        'scheduled',
        'job-1',
      );
      expect(result).toMatchObject({ status: 'success' });
    });

    it('targets a picked post for a VOTE command', async () => {
      const { runner, picker, executor, logService } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      logService.writeSuccess.mockResolvedValue({ id: 'log-1' });
      picker.pickTargetPost.mockResolvedValue('post-3');

      await runner.runScheduledTick({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'VOTE',
        executionSource: 'scheduled',
      });

      expect(picker.pickTargetPost).toHaveBeenCalledWith('world-1');
      expect(executor.execute).toHaveBeenCalledWith({
        action: 'VOTE',
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        postId: 'post-3',
      });
    });

    it('logs a lifecycle rejection as REJECTED and never retries', async () => {
      const { runner, logService } = createRunner({ gateState: 'halted' });
      logService.writeRejected.mockResolvedValue({ id: 'log-9' });

      const result = await runner.runScheduledTick({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'scheduled',
        jobId: 'job-4',
      });

      expect(logService.writeRejected).toHaveBeenCalledWith({
        worldId: 'world-1',
        characterId: 'character-1',
        action: 'POST',
        executionSource: 'scheduled',
        provider: 'mock',
        model: 'fixture-model',
        reason: 'Simulation scheduled work is rejected in state HALTED',
        jobId: 'job-4',
      });
      expect(result).toEqual({
        status: 'rejected',
        reason: 'Simulation scheduled work is rejected in state HALTED',
        log: { id: 'log-9' },
      });
    });

    it('returns a retryable failure without persisting content', async () => {
      const { runner, executor, contentWriter, logService } = createRunner();
      executor.execute.mockResolvedValue({
        status: 'failed',
        failure: {
          code: 'TIMEOUT',
          message: 'Provider request timed out',
          retryable: true,
        },
      });
      logService.writeFailure.mockResolvedValue({ id: 'log-2' });

      const result = await runner.runScheduledTick({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'scheduled',
        jobId: 'job-2',
      });

      expect(contentWriter.persist).not.toHaveBeenCalled();
      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-2',
          failure: expect.objectContaining({ retryable: true }),
        }),
      );
      expect(result).toMatchObject({ status: 'failed' });
    });

    it('returns a non-retryable failure when no post exists to act on', async () => {
      const { runner, picker, executor } = createRunner();
      picker.pickTargetPost.mockResolvedValue(null);

      const result = await runner.runScheduledTick({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'VOTE',
        executionSource: 'scheduled',
      });

      expect(executor.execute).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        status: 'failed',
        failure: { code: 'NO_ACTIVE_TARGET', retryable: false },
      });
    });
  });

  describe('runManualIteration', () => {
    it('uses a specific character and forced action', async () => {
      const { runner, lifecycleService, picker, executor, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      logService.writeSuccess.mockResolvedValue({ id: 'log-1' });

      const result = await runner.runManualIteration({
        worldSlug: 'mbti-house',
        characterId: 'character-2',
        actionType: 'COMMENT',
        executionSource: 'custom',
      });

      expect(lifecycleService.assertManualWorkAllowed).toHaveBeenCalledWith(
        'world-1',
      );
      expect(picker.pickCharacter).not.toHaveBeenCalled();
      expect(picker.pickAction).not.toHaveBeenCalled();
      expect(executor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMENT',
          characterId: 'character-2',
        }),
      );
      expect(result).toMatchObject({ status: 'success' });
    });

    it('composes Any Resident and Automatic via the picker', async () => {
      const { runner, picker, executor, logService } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      logService.writeSuccess.mockResolvedValue({ id: 'log-1' });
      picker.pickCharacter.mockResolvedValue({
        characterId: 'character-3',
        memberId: 'member-3',
      });
      picker.pickAction.mockReturnValue('VOTE');
      picker.pickTargetPost.mockResolvedValue('post-5');

      const result = await runner.runManualIteration({
        worldSlug: 'mbti-house',
        executionSource: 'one-action',
      });

      expect(picker.pickCharacter).toHaveBeenCalledWith('world-1');
      expect(picker.pickAction).toHaveBeenCalledWith(config.actionWeights);
      expect(executor.execute).toHaveBeenCalledWith({
        action: 'VOTE',
        worldSlug: 'mbti-house',
        characterId: 'character-3',
        postId: 'post-5',
      });
      expect(logService.writeSuccess).toHaveBeenCalledWith(
        postDecision,
        expect.anything(),
        'one-action',
        undefined,
      );
      expect(result).toMatchObject({ status: 'success' });
    });

    it('throws when manual work is rejected in HALTED', async () => {
      const { runner } = createRunner({ gateState: 'halted' });

      await expect(
        runner.runManualIteration({
          worldSlug: 'mbti-house',
          characterId: 'character-1',
          actionType: 'POST',
          executionSource: 'custom',
        }),
      ).rejects.toBeInstanceOf(SimulationWorkRejectedError);
    });

    it('returns a failure result when the executor fails', async () => {
      const { runner, executor } = createRunner();
      executor.execute.mockResolvedValue({
        status: 'failed',
        failure: {
          code: 'CHARACTER_INACTIVE',
          message: 'Character is inactive',
          retryable: false,
        },
      });

      const result = await runner.runManualIteration({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'custom',
      });

      expect(result).toMatchObject({
        status: 'failed',
        failure: { code: 'CHARACTER_INACTIVE' },
      });
    });
  });
});
