import type {
  ScheduledTurn,
  SimulationIteration,
} from '@aiworld/shared/schemas/simulation-iteration.schema';

import { loadProviderConfig } from '@/lib/llm/provider-config';
import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import {
  PostDecision,
  SimulationActionOutcome,
} from '@/simulation/actions/simulation-decision';
import { VoteAction } from '@/simulation/actions/vote.action';
import { SimulationConfig } from '@/simulation/lifecycle/domain/simulation-config';
import {
  SimulationConfigMalformedError,
  SimulationConfigNotFoundError,
  SimulationWorkRejectedError,
} from '@/simulation/lifecycle/simulation-lifecycle.error';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationLogEntry } from '@/simulation/logging/simulation-log.service';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRunner } from '@/simulation/scheduler/simulation-runner';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { WorldService, WorldView } from '@/world/world.service';

const world: WorldView = {
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

const config: SimulationConfig = {
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

function scheduledTurn(
  overrides?: Partial<Pick<ScheduledTurn, 'characterId' | 'actionType'>>,
): ScheduledTurn;
function scheduledTurn(
  overrides: Partial<SimulationIteration>,
): SimulationIteration;
function scheduledTurn(
  overrides: Partial<SimulationIteration> = {},
): SimulationIteration {
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
  overrides: Partial<SimulationLogEntry> = {},
): SimulationLogEntry {
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
    simulationConfig?: SimulationConfig;
    provider?: LlmProvider;
    narrativeService?: Pick<WorldNarrativeService, 'enqueue'>;
    execute?: (input: unknown) => Promise<SimulationActionOutcome>;
  } = {},
) {
  const worldService = {
    getBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as jest.Mocked<Pick<WorldService, 'getBySlug'>>;
  const lifecycleConfig = overrides.simulationConfig ?? config;
  const lifecycleService = {
    getByWorldId: jest.fn().mockResolvedValue(lifecycleConfig),
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
    pickAutomaticAction: jest.fn().mockResolvedValue('POST'),
    pickTargetPost: jest.fn().mockResolvedValue('post-1'),
    findActiveActor: jest.fn().mockResolvedValue(true),
  } as unknown as jest.Mocked<SimulationIterationPicker>;

  const execute = jest.fn();
  if (overrides.execute !== undefined) {
    execute.mockImplementation(overrides.execute);
  }
  const postAction = { execute } as unknown as jest.Mocked<PostAction>;
  const voteAction = { execute } as unknown as jest.Mocked<VoteAction>;
  const commentAction = { execute } as unknown as jest.Mocked<CommentAction>;

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
  const narrativeService =
    overrides.narrativeService ?? ({ enqueue: jest.fn() } as const);

  const runner = new SimulationRunner(
    worldService as never,
    lifecycleService as never,
    picker,
    postAction,
    voteAction,
    commentAction,
    contentWriter,
    logService,
    provider,
    narrativeService as WorldNarrativeService,
  );

  return {
    runner,
    worldService,
    lifecycleService,
    picker,
    executor: { execute },
    postAction,
    voteAction,
    commentAction,
    contentWriter,
    logService,
    narrativeService,
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

describe('SimulationRunner', () => {
  describe('runScheduledTurn', () => {
    it('gates scheduled work, uses the process-global provider, persists, and logs', async () => {
      const {
        runner,
        lifecycleService,
        executor,
        contentWriter,
        logService,
        narrativeService,
      } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);

      const result = await runner.runScheduledTurn(scheduledTurn(), 'job-1');

      expect(lifecycleService.assertScheduledWorkAllowed).toHaveBeenCalledWith(
        'world-1',
      );
      expect(executor.execute).toHaveBeenCalledWith({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
      });
      expect(contentWriter.persist).toHaveBeenCalledWith(postDecision);
      expect(narrativeService.enqueue).toHaveBeenCalledWith('world-1');
      expect(logService.writeSuccess).toHaveBeenCalledWith(
        postDecision,
        expect.objectContaining({ source: 'mock' }),
        'scheduled',
        'job-1',
      );
      expect(result).toMatchObject({ status: 'success' });
    });

    it('keeps a successful saved action successful when narrative enqueue fails', async () => {
      const narrativeService = {
        enqueue: jest.fn().mockRejectedValue(new Error('Redis unavailable')),
      };
      const { runner, executor, logService } = createRunner({
        narrativeService,
      });
      executor.execute.mockResolvedValue(successOutcome);

      await expect(
        runner.runScheduledTurn(scheduledTurn()),
      ).resolves.toMatchObject({
        status: 'success',
      });
      expect(logService.writeSuccess).toHaveBeenCalled();
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

        await runner.runScheduledTurn(scheduledTurn(), 'job-global');

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
        } as unknown as SimulationConfig;
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
          findRecentPosts: jest.fn().mockResolvedValue([]),
        };
        const { runner, executor, contentWriter, logService } = createRunner({
          provider: processProvider,
          simulationConfig: legacyWorldConfig,
          execute: async (input) =>
            new PostAction(contextProvider as never, processProvider).execute(
              input as never,
            ),
        });

        const result = await runner.runScheduledTurn(
          scheduledTurn(),
          `job-${model}`,
        );

        expect(result).toMatchObject({ status: 'success' });
        expect(executor.execute).toHaveBeenCalledWith({
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

    it('allows admitted work to finish when the World deactivates mid-iteration', async () => {
      const { runner, worldService, executor, contentWriter, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);

      const result = await runner.runScheduledTurn(scheduledTurn(), 'job-8');

      expect(worldService.getBySlug).toHaveBeenCalledWith('mbti-house', true);
      expect(contentWriter.persist).toHaveBeenCalledWith(postDecision);
      expect(logService.writeSuccess).toHaveBeenCalledWith(
        postDecision,
        expect.anything(),
        'scheduled',
        'job-8',
      );
      expect(result).toMatchObject({ status: 'success' });
    });

    it('lets deleted Worlds dead-letter without writing a cascaded log', async () => {
      const { runner, worldService, executor, contentWriter, logService } =
        createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      worldService.getBySlug.mockResolvedValue(null);

      await expect(
        runner.runScheduledTurn(scheduledTurn(), 'job-9'),
      ).rejects.toMatchObject({
        code: 'WORLD_NOT_FOUND',
        message: 'World "mbti-house" was not found',
      });

      expect(contentWriter.persist).not.toHaveBeenCalled();
      expect(logService.writeRejected).not.toHaveBeenCalled();
      expect(logService.writeFailure).not.toHaveBeenCalled();
    });

    it('targets a picked post for a VOTE Iteration', async () => {
      const { runner, picker, executor, narrativeService } = createRunner();
      executor.execute.mockResolvedValue({
        ...successOutcome,
        decision: {
          action: 'VOTE',
          worldId: 'world-1',
          memberId: 'member-1',
          characterId: 'character-1',
          postId: 'post-3',
          decision: 'upvote',
          reasoning: 'The post is useful.',
        },
      });
      picker.pickTargetPost.mockResolvedValue('post-3');

      await runner.runScheduledTurn(scheduledTurn({ actionType: 'VOTE' }));

      expect(picker.pickTargetPost).toHaveBeenCalledWith('world-1');
      expect(executor.execute).toHaveBeenCalledWith({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        postId: 'post-3',
      });
      expect(narrativeService.enqueue).not.toHaveBeenCalled();
    });

    it('logs a lifecycle rejection as REJECTED and never retries', async () => {
      const { runner, logService } = createRunner({ gateState: 'halted' });

      const result = await runner.runScheduledTurn(scheduledTurn(), 'job-4');

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

      const result = await runner.runScheduledTurn(scheduledTurn(), 'job-2');

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

      const result = await runner.runScheduledTurn(
        scheduledTurn(),
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

    it.each(['VOTE', 'COMMENT'] as const)(
      'returns a non-retryable failure for forced %s when no post exists',
      async (actionType) => {
        const { runner, picker, executor } = createRunner();
        picker.pickTargetPost.mockResolvedValue(null);

        const result = await runner.runScheduledTurn(
          scheduledTurn({ actionType }),
        );

        expect(executor.execute).not.toHaveBeenCalled();
        expect(result).toMatchObject({
          status: 'failed',
          failure: { code: 'NO_ACTIVE_TARGET', retryable: false },
        });
      },
    );

    it.each([
      ['missing configuration', new SimulationConfigNotFoundError('world-1')],
      [
        'malformed configuration',
        new SimulationConfigMalformedError(
          'world-1',
          'configuration is malformed',
        ),
      ],
      ['configuration lookup error', new Error('configuration lookup failed')],
    ] as const)('leaves a %s as a scheduler fault', async (_label, failure) => {
      const { runner, lifecycleService, logService } = createRunner();
      lifecycleService.assertScheduledWorkAllowed.mockRejectedValue(failure);

      await expect(
        runner.runScheduledTurn(scheduledTurn(), 'job-config'),
      ).rejects.toBe(failure);
      expect(logService.writeFailure).not.toHaveBeenCalled();
    });

    it('leaves a raw write-path error as a scheduler fault', async () => {
      const { runner, executor, contentWriter, logService } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);
      contentWriter.persist.mockRejectedValue({
        name: 'PrismaClientKnownRequestError',
        code: 'P1001',
        message: "Can't reach database",
      });

      await expect(
        runner.runScheduledTurn(scheduledTurn(), 'job-6'),
      ).rejects.toMatchObject({ code: 'P1001' });
      expect(logService.writeFailure).not.toHaveBeenCalled();
    });

    it('leaves a failed-Iteration logging error as a scheduler fault', async () => {
      const { runner, executor, logService } = createRunner();
      const loggingFailure = new Error('logging database unavailable');
      executor.execute.mockResolvedValue({
        status: 'failed',
        failure: {
          code: 'CHARACTER_INACTIVE',
          message: 'Character is inactive',
          retryable: false,
        },
      });
      logService.writeFailure.mockRejectedValue(loggingFailure);

      await expect(
        runner.runScheduledTurn(scheduledTurn(), 'job-log-failure'),
      ).rejects.toBe(loggingFailure);
    });
  });

  describe('runManualIteration', () => {
    it('uses the composed Iteration and gates manual work', async () => {
      const { runner, lifecycleService, executor, logService } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);

      const result = await runner.runManualIteration(
        scheduledTurn({
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
        runner.runManualIteration(scheduledTurn({ executionSource: 'custom' })),
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
        scheduledTurn({ executionSource: 'custom' }),
      );

      expect(result).toMatchObject({
        status: 'failed',
        failure: { code: 'CHARACTER_INACTIVE' },
      });
    });
  });

  describe('manual action composition', () => {
    it('selects and runs one automatic Iteration through the same runner', async () => {
      const { runner, picker, executor } = createRunner();
      executor.execute.mockResolvedValue(successOutcome);

      const result = await runner.runOneAction('mbti-house');

      expect(picker.pickCharacter).toHaveBeenCalledWith('world-1');
      expect(picker.pickAutomaticAction).toHaveBeenCalledWith(
        'world-1',
        config.actionWeights,
      );
      expect(executor.execute).toHaveBeenCalledWith({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
      });
      expect(result).toMatchObject({ status: 'success' });
    });

    it('validates an explicit Custom Action actor before execution', async () => {
      const { runner, picker, executor } = createRunner();
      picker.findActiveActor.mockResolvedValue(false);

      await expect(
        runner.runCustomAction({
          worldSlug: 'mbti-house',
          characterId: 'foreign-character',
          actionType: 'POST',
        }),
      ).rejects.toThrow('not an active member of World');
      expect(executor.execute).not.toHaveBeenCalled();
    });
  });
});
