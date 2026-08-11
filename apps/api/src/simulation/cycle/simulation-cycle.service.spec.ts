import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { SimulationWriteError } from '@/simulation/actions/simulation-action.error';
import {
  SimulationActionOutcome,
  SimulationDecision,
} from '@/simulation/actions/simulation-decision';
import { SimulationCycleService } from '@/simulation/cycle/simulation-cycle.service';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

const world = {
  id: 'world-1',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: null,
  rules: [],
  topicScope: 'Personality debates',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const postDecision: SimulationDecision = {
  action: 'POST',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  title: 'A title',
  content: 'Body.',
  reasoning: 'R',
};

const voteDecision: SimulationDecision = {
  action: 'VOTE',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  postId: 'post-1',
  decision: 'upvote',
  reasoning: 'R',
};

const commentDecision: SimulationDecision = {
  action: 'COMMENT',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  postId: 'post-1',
  content: 'Agreed.',
  parentCommentId: null,
  reasoning: 'R',
};

const telemetry = {
  source: 'mock',
  model: 'fixture-model',
  latencyMs: 7,
  tokens: { prompt: 10, completion: 5, total: 15 },
};

const logRecord = {
  id: 'log-1',
  worldId: 'world-1',
  characterId: 'character-1',
  action: 'POST' as const,
  targetId: null,
  reasoning: null,
  provider: 'mock',
  model: 'fixture-model',
  latencyMs: 7,
  executionSource: 'RUN_ONE_CYCLE' as const,
  tokensUsed: 15,
  costEstimate: 0.00003,
  status: 'SUCCESS' as const,
  errorMessage: null,
  executedAt: new Date(),
};

function successOutcome(decision: SimulationDecision): SimulationActionOutcome {
  return { status: 'success', decision, telemetry };
}

function createService(overrides: {
  executorOutcomes?: SimulationActionOutcome[];
  world?: typeof world | null;
  persist?: (decision: SimulationDecision) => Promise<{ id: string } | null>;
  writeFailure?: jest.Mock;
}) {
  const worldRepository = {
    findBySlug: jest
      .fn()
      .mockResolvedValue(
        overrides.world === undefined ? world : overrides.world,
      ),
  } as unknown as jest.Mocked<WorldRepository>;

  const executor = {
    execute: jest.fn(),
  } as unknown as jest.Mocked<SimulationActionExecutor>;
  if (overrides.executorOutcomes) {
    for (const outcome of overrides.executorOutcomes) {
      executor.execute.mockResolvedValueOnce(outcome);
    }
  }

  const writer = {
    persist: jest.fn(),
  } as unknown as jest.Mocked<SimulationContentWriter>;
  if (overrides.persist) {
    writer.persist.mockImplementation(overrides.persist);
  } else {
    writer.persist.mockResolvedValue({ id: 'created-1' });
  }

  const logService = {
    writeSuccess: jest.fn().mockResolvedValue(logRecord),
    writeFailure: jest.fn().mockResolvedValue(logRecord),
  } as unknown as jest.Mocked<SimulationLogService>;
  if (overrides.writeFailure) {
    logService.writeFailure.mockImplementation(overrides.writeFailure);
  }

  const provider = {
    config: { providerId: 'mock', model: 'fixture-model' },
  } as unknown as LlmProvider;

  const service = new SimulationCycleService(
    worldRepository,
    executor,
    writer,
    logService,
    provider,
  );

  return { service, worldRepository, executor, writer, logService };
}

const input = {
  worldSlug: 'mbti-house',
  characterId: 'character-1',
  executionSource: 'RUN_ONE_CYCLE' as const,
};

describe('SimulationCycleService', () => {
  it('persists a post, vote, and comment and logs all three as successes', async () => {
    const { service, executor, writer, logService } = createService({
      executorOutcomes: [
        successOutcome(postDecision),
        successOutcome(voteDecision),
        successOutcome(commentDecision),
      ],
    });

    const result = await service.runCycle(input);

    expect(executor.execute).toHaveBeenNthCalledWith(1, {
      action: 'POST',
      worldSlug: 'mbti-house',
      characterId: 'character-1',
    });
    expect(executor.execute).toHaveBeenNthCalledWith(2, {
      action: 'VOTE',
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      postId: 'created-1',
    });
    expect(executor.execute).toHaveBeenNthCalledWith(3, {
      action: 'COMMENT',
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      postId: 'created-1',
    });

    expect(writer.persist).toHaveBeenCalledTimes(3);
    expect(logService.writeSuccess).toHaveBeenCalledTimes(3);
    expect(logService.writeFailure).not.toHaveBeenCalled();

    expect(result.status).toBe('success');
    expect(result.failure).toBeNull();
    expect(result.steps).toHaveLength(3);
    expect(result.steps.map((step) => step.step)).toEqual([
      'POST',
      'VOTE',
      'COMMENT',
    ]);
    expect(result.steps.map((step) => step.status)).toEqual([
      'success',
      'success',
      'success',
    ]);
  });

  it('threads the created post id into the vote and comment commands', async () => {
    const { service, executor } = createService({});
    executor.execute
      .mockResolvedValueOnce(successOutcome(postDecision))
      .mockResolvedValueOnce(successOutcome(voteDecision))
      .mockResolvedValueOnce(successOutcome(commentDecision));

    await service.runCycle(input);

    const commands = (executor.execute as jest.Mock).mock.calls.map(
      (call) => call[0],
    );
    expect(commands[1]).toMatchObject({ postId: 'created-1' });
    expect(commands[2]).toMatchObject({ postId: 'created-1' });
  });

  it('stops after a failed post action and logs only the failure', async () => {
    const { service, executor, writer, logService } = createService({
      executorOutcomes: [
        {
          status: 'failed',
          failure: {
            code: 'TIMEOUT',
            message: 'Mock timeout',
            retryable: true,
          },
        },
      ],
    });

    const result = await service.runCycle(input);

    expect(executor.execute).toHaveBeenCalledTimes(1);
    expect(writer.persist).not.toHaveBeenCalled();
    expect(logService.writeFailure).toHaveBeenCalledTimes(1);
    expect(logService.writeSuccess).not.toHaveBeenCalled();

    expect(result.status).toBe('failed');
    expect(result.failure).toMatchObject({ code: 'TIMEOUT' });
    expect(result.steps[0]).toMatchObject({ step: 'POST', status: 'failed' });
  });

  it('logs a skipped vote as SKIPPED and keeps the cycle running', async () => {
    const { service, logService } = createService({
      executorOutcomes: [
        successOutcome(postDecision),
        successOutcome({ ...voteDecision, decision: 'skip' }),
        successOutcome(commentDecision),
      ],
    });

    const result = await service.runCycle(input);

    expect(result.status).toBe('success');
    expect(result.steps[1]).toMatchObject({ step: 'VOTE', status: 'skipped' });
    expect(result.steps[2]).toMatchObject({
      step: 'COMMENT',
      status: 'success',
    });
    expect(logService.writeSuccess).toHaveBeenCalledTimes(3);
  });

  it('turns a write rejection into a logged FAILED step, not a crash', async () => {
    const { service, writer, logService } = createService({
      executorOutcomes: [
        successOutcome(postDecision),
        successOutcome(voteDecision),
        successOutcome(commentDecision),
      ],
      persist: (decision) =>
        decision.action === 'COMMENT'
          ? Promise.reject(
              new SimulationWriteError(
                'COMMENT_DEPTH_EXCEEDED',
                'Comments cannot be nested deeper than 3 levels',
              ),
            )
          : Promise.resolve({ id: 'created-1' }),
    });

    const result = await service.runCycle(input);

    expect(result.status).toBe('failed');
    expect(result.steps[2]).toMatchObject({
      step: 'COMMENT',
      status: 'failed',
    });
    expect(writer.persist).toHaveBeenCalledTimes(3);
    expect(logService.writeFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMMENT',
        targetId: 'created-1',
        failure: expect.objectContaining({ code: 'COMMENT_DEPTH_EXCEEDED' }),
      }),
    );
  });

  it('fails fast when the world is missing, before any provider call', async () => {
    const { service, executor } = createService({ world: null });

    const result = await service.runCycle(input);

    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure).toMatchObject({ code: 'WORLD_NOT_FOUND' });
    expect(result.steps).toEqual([]);
  });

  it('logs a FAILED step when the world exists but is inactive', async () => {
    const { service, executor, logService } = createService({
      world: { ...world, isActive: false },
    });

    const result = await service.runCycle(input);

    expect(executor.execute).not.toHaveBeenCalled();
    expect(result.status).toBe('failed');
    expect(result.failure).toMatchObject({ code: 'WORLD_NOT_FOUND' });
    expect(result.steps).toHaveLength(1);
    expect(result.steps[0]).toMatchObject({
      step: 'POST',
      status: 'failed',
    });
    expect(logService.writeFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        worldId: 'world-1',
        characterId: 'character-1',
        action: 'POST',
        failure: expect.objectContaining({ code: 'WORLD_NOT_FOUND' }),
      }),
    );
  });
});
