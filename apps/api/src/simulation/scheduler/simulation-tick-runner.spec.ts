import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostAction } from '@/simulation/actions/post.action';
import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { SimulationCommand } from '@/simulation/actions/simulation-command';
import {
  PostDecision,
  SimulationActionOutcome,
} from '@/simulation/actions/simulation-decision';
import { WorldSimulationConfigRecord } from '@/simulation/lifecycle/domain/world-simulation-config-record';
import {
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
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
  residentCount: 16,
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

function scheduledCommand(
  overrides: Partial<{
    characterId: string;
    actionType: 'POST' | 'VOTE' | 'COMMENT';
    executionSource: 'scheduled' | 'one-action' | 'custom';
  }> = {},
) {
  return {
    worldSlug: 'mbti-house',
    characterId: 'character-1',
    actionType: 'POST' as const,
    executionSource: 'scheduled' as const,
    issuedAt: '2026-08-13T00:00:00.000Z',
    ...overrides,
  };
}

function logRecord(
  overrides: Partial<SimulationLogRecord> = {},
): SimulationLogRecord {
  return {
    id: 'log-1',
    worldId: 'world-1',
    characterId: 'character-1',
    action: 'POST',
    targetId: null,
    reasoning: null,
    provider: 'mock',
    model: 'fixture-model',
    latencyMs: null,
    jobId: null,
    executionSource: 'scheduled',
    tokensUsed: null,
    costEstimate: null,
    status: 'SUCCESS',
    errorMessage: null,
    executedAt: new Date('2026-08-13T00:00:00.000Z'),
    ...overrides,
  };
}

function createRunner(
  overrides: {
    gateState?: 'scheduled' | 'manual' | 'halted';
    providerConfig?: { providerId: string; model: string };
    simulationConfig?: WorldSimulationConfigRecord;
    provider?: LlmProvider;
    execute?: (
      command: SimulationCommand,
      provider?: LlmProvider,
    ) => Promise<SimulationActionOutcome>;
  } = {},
) {
  const worldRepository = {
    findBySlug: jest.fn().mockResolvedValue(world),
    withActiveSimulationLock: jest.fn(async (_worldId, operation) => ({
      status: 'executed' as const,
      value: await operation(),
    })),
  } as unknown as jest.Mocked<WorldRepository>;
  const lifecycleConfig = overrides.simulationConfig ?? config;
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
    lifecycleService.assertScheduledWorkAllowed.mockResolvedValue(
      lifecycleConfig,
    );
    lifecycleService.assertManualWorkAllowed.mockResolvedValue(lifecycleConfig);
  }

  const picker = {
    pickCharacter: jest.fn().mockResolvedValue({ characterId: 'character-1' }),
    pickAction: jest.fn().mockReturnValue('POST'),
    pickTargetPost: jest.fn().mockResolvedValue('post-1'),
  } as unknown as jest.Mocked<SimulationIterationPicker>;

  const execute = jest.fn();
  if (overrides.execute !== undefined) {
    execute.mockImplementation(overrides.execute);
  }
  const executor = {
    execute,
  } as unknown as jest.Mocked<SimulationActionExecutor>;

  const contentWriter = {
    persist: jest.fn().mockResolvedValue({ id: 'post-9' }),
  } as unknown as jest.Mocked<SimulationContentWriter>;

  const logService = {
    writeSuccess: jest.fn().mockResolvedValue(logRecord()),
    writeFailure: jest.fn().mockResolvedValue(logRecord({ status: 'FAILED' })),
    writeRejected: jest
      .fn()
      .mockResolvedValue(logRecord({ status: 'REJECTED' })),
  } as unknown as jest.Mocked<SimulationLogService>;

  const provider =
    overrides.provider ??
    ({
      config: overrides.providerConfig ?? {
        providerId: 'mock',
        model: 'fixture-model',
      },
    } as unknown as LlmProvider);

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
    it('gates scheduled work, uses the process-global provider, persists, and logs', async () => {
      const { runner, lifecycleService, executor, contentWriter, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);

      const result = await runner.runScheduledTick(scheduledCommand(), 'job-1');

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
    it.each([
      { providerId: 'mock', model: 'server-model-v1' },
      { providerId: 'openai-compatible', model: 'server-model-v2' },
    ] as const)(
      'logs the current process provider/model rather than World configuration',
      async (providerConfig) => {
        const { runner, executor, logService } = createRunner({
          providerConfig,
        });
        executor.execute.mockResolvedValue({
          status: 'failed',
          failure: {
            code: 'TIMEOUT',
            message: 'Provider request timed out',
            retryable: true,
          },
        });

        await runner.runScheduledTick(scheduledCommand(), 'job-global');

        expect(logService.writeFailure).toHaveBeenCalledWith(
          expect.objectContaining({
            provider: providerConfig.providerId,
            model: providerConfig.model,
            jobId: 'job-global',
          }),
        );
      },
    );

    it.each(['server-model-v1', 'server-model-v2'] as const)(
      'executes actions with the process provider, ignoring legacy World LLM fields (%s)',
      async (model) => {
        const processProvider = new MockLlmProvider(
          loadProviderConfig({
            LLM_PROVIDER: 'mock',
            LLM_MODEL: model,
          }),
          [
            {
              id: 'post',
              output: {
                title: postDecision.title,
                content: postDecision.content,
                reasoning: postDecision.reasoning,
              },
            },
          ],
        );
        const legacyWorldConfig = {
          ...config,
          providerId: 'mock',
          model: 'legacy-world-model',
        } as unknown as WorldSimulationConfigRecord;
        const contextProvider = {
          resolveActor: jest.fn().mockResolvedValue({
            world,
            character: {
              id: 'character-1',
              handle: 'resident',
              name: 'Resident',
              classification: 'ISTJ',
              classificationGroup: 'SJ',
              avatarUrl: null,
              biography: 'Loves order.',
              traits: ['Rigorous'],
              systemPrompt: 'You are Resident.',
              isActive: true,
              createdAt: new Date('2026-08-01T00:00:00.000Z'),
              updatedAt: new Date('2026-08-01T00:00:00.000Z'),
            },
            memberId: 'member-1',
          }),
        };
        const { runner, executor, contentWriter, logService } = createRunner({
          provider: processProvider,
          simulationConfig: legacyWorldConfig,
          execute: async (command, providerOverride) =>
            new PostAction(
              contextProvider as never,
              providerOverride ?? processProvider,
            ).execute(command as never),
        });

        const result = await runner.runScheduledTick(
          scheduledCommand(),
          `job-${model}`,
        );

        expect(result).toMatchObject({ status: 'success' });
        expect(executor.execute).toHaveBeenCalledWith({
          action: 'POST',
          worldSlug: 'mbti-house',
          characterId: 'character-1',
        });
        expect(contentWriter.persist).toHaveBeenCalledWith(postDecision);
        expect(logService.writeSuccess).toHaveBeenCalledWith(
          postDecision,
          expect.objectContaining({ source: 'mock', model }),
          'scheduled',
          `job-${model}`,
        );
      },
    );

    it('rejects before persistence when the World deactivates mid-iteration', async () => {
      const { runner, worldRepository, executor, contentWriter, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      worldRepository.withActiveSimulationLock.mockResolvedValue({
        status: 'inactive',
      });

      const result = await runner.runScheduledTick(scheduledCommand(), 'job-8');

      expect(contentWriter.persist).not.toHaveBeenCalled();
      expect(logService.writeRejected).toHaveBeenCalledWith(
        expect.objectContaining({
          reason:
            'Simulation scheduled work is rejected because World is inactive',
          jobId: 'job-8',
        }),
      );
      expect(result).toMatchObject({ status: 'rejected' });
    });

    it('lets deleted Worlds dead-letter without writing a cascaded log', async () => {
      const { runner, worldRepository, executor, contentWriter, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      worldRepository.withActiveSimulationLock.mockResolvedValue({
        status: 'missing',
      });

      await expect(
        runner.runScheduledTick(scheduledCommand(), 'job-9'),
      ).rejects.toMatchObject({
        code: 'WORLD_NOT_FOUND',
      });

      expect(contentWriter.persist).not.toHaveBeenCalled();
      expect(logService.writeRejected).not.toHaveBeenCalled();
      expect(logService.writeFailure).not.toHaveBeenCalled();
    });

    it('targets a picked post for a VOTE command', async () => {
      const { runner, picker, executor } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      picker.pickTargetPost.mockResolvedValue('post-3');

      await runner.runScheduledTick(scheduledCommand({ actionType: 'VOTE' }));

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

      const result = await runner.runScheduledTick(scheduledCommand(), 'job-4');

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
        log: logRecord({ status: 'REJECTED' }),
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

      const result = await runner.runScheduledTick(scheduledCommand(), 'job-2');

      expect(contentWriter.persist).not.toHaveBeenCalled();
      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-2',
          failure: expect.objectContaining({ retryable: true }),
        }),
      );
      expect(result).toMatchObject({ status: 'failed' });
    });

    it('records unsafe provider output as a visible permanent failure', async () => {
      const { runner, executor, contentWriter, logService } = createRunner();
      executor.execute.mockResolvedValue({
        status: 'failed',
        failure: {
          code: 'UNSAFE_OUTPUT',
          message: 'Generated output did not pass the safety checks',
          retryable: false,
        },
      });

      const result = await runner.runScheduledTick(
        scheduledCommand(),
        'job-unsafe',
      );

      expect(contentWriter.persist).not.toHaveBeenCalled();
      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-unsafe',
          failure: expect.objectContaining({
            code: 'UNSAFE_OUTPUT',
            retryable: false,
          }),
        }),
      );
      expect(result).toMatchObject({
        status: 'failed',
        failure: { code: 'UNSAFE_OUTPUT', retryable: false },
      });
    });

    it('returns a non-retryable failure when no post exists to act on', async () => {
      const { runner, picker, executor } = createRunner();
      picker.pickTargetPost.mockResolvedValue(null);

      const result = await runner.runScheduledTick(
        scheduledCommand({ actionType: 'VOTE' }),
      );

      expect(executor.execute).not.toHaveBeenCalled();
      expect(result).toMatchObject({
        status: 'failed',
        failure: { code: 'NO_ACTIVE_TARGET', retryable: false },
      });
    });

    it('writes a FAILED log for a permanent error before the executor path', async () => {
      const { runner, lifecycleService, logService } = createRunner();
      lifecycleService.assertScheduledWorkAllowed.mockRejectedValue(
        new SimulationConfigNotFoundError('world-1'),
      );

      const result = await runner.runScheduledTick(scheduledCommand(), 'job-5');

      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-5',
          worldId: 'world-1',
          failure: expect.objectContaining({ retryable: false }),
        }),
      );
      expect(result).toMatchObject({ status: 'failed' });
    });

    it('logs configuration failures with process-global metadata', async () => {
      const { runner, lifecycleService, logService } = createRunner();
      const malformed = new SimulationConfigMalformedError(
        'world-1',
        'configuration is malformed',
      );
      lifecycleService.assertScheduledWorkAllowed.mockRejectedValue(malformed);

      const result = await runner.runScheduledTick(
        scheduledCommand(),
        'job-10',
      );

      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mock',
          model: 'fixture-model',
          jobId: 'job-10',
        }),
      );
      expect(result).toMatchObject({ status: 'failed' });
    });

    it('preserves process-global metadata when configuration lookup fails', async () => {
      const { runner, lifecycleService, logService } = createRunner();
      const lookupFailure = new Error('configuration lookup failed');
      lifecycleService.assertScheduledWorkAllowed.mockRejectedValue(
        lookupFailure,
      );

      const result = await runner.runScheduledTick(
        scheduledCommand(),
        'job-11',
      );

      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'mock',
          model: 'fixture-model',
          jobId: 'job-11',
        }),
      );
      expect(result).toMatchObject({ status: 'failed' });
    });

    it('logs a transient write-path error as a retryable failed result', async () => {
      const { runner, executor, contentWriter, logService } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      contentWriter.persist.mockRejectedValue({
        name: 'PrismaClientKnownRequestError',
        code: 'P1001',
        message: "Can't reach database",
      });

      const result = await runner.runScheduledTick(scheduledCommand(), 'job-6');

      expect(logService.writeFailure).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job-6',
          failure: expect.objectContaining({ retryable: true }),
        }),
      );
      expect(result).toMatchObject({
        status: 'failed',
        failure: { retryable: true },
      });
    });

    it('throws when the World itself is unresolvable (DLQ records it)', async () => {
      const { runner, worldRepository } = createRunner();
      worldRepository.findBySlug.mockResolvedValue(null);

      await expect(
        runner.runScheduledTick(scheduledCommand(), 'job-7'),
      ).rejects.toThrow('World "mbti-house" was not found');
    });
  });

  describe('runManualIteration', () => {
    it('uses the composed command and gates manual work', async () => {
      const { runner, lifecycleService, executor, logService } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);

      const result = await runner.runManualIteration(
        scheduledCommand({
          characterId: 'character-2',
          actionType: 'COMMENT',
          executionSource: 'custom',
        }),
      );

      expect(lifecycleService.assertManualWorkAllowed).toHaveBeenCalledWith(
        'world-1',
      );
      expect(executor.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'COMMENT',
          characterId: 'character-2',
        }),
      );
      expect(logService.writeSuccess).toHaveBeenCalledWith(
        postDecision,
        expect.anything(),
        'custom',
        undefined,
      );
      expect(result).toMatchObject({ status: 'success' });
    });

    it('throws when manual work is rejected in HALTED', async () => {
      const { runner } = createRunner({ gateState: 'halted' });

      await expect(
        runner.runManualIteration(
          scheduledCommand({ executionSource: 'custom' }),
        ),
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

      const result = await runner.runManualIteration(
        scheduledCommand({ executionSource: 'custom' }),
      );

      expect(result).toMatchObject({
        status: 'failed',
        failure: { code: 'CHARACTER_INACTIVE' },
      });
    });
  });
});
