import {
  CommentDecision,
  PostDecision,
  VoteDecision,
} from '@/simulation/actions/simulation-decision';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';
import { SimulationLogRepository } from '@/simulation/logging/simulation-log-repository.interface';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';

const telemetry = {
  source: 'mock',
  model: 'fixture-model',
  latencyMs: 7,
  tokens: { prompt: 10, completion: 5, total: 15 },
};

function createService() {
  const repository = {
    create: jest.fn(),
  } as unknown as SimulationLogRepository;
  const costEstimator = new SimulationCostEstimator({
    inputPerMillionUsd: 1,
    outputPerMillionUsd: 4,
  });
  const service = new SimulationLogService(repository, costEstimator);
  return { service, repository };
}

const postDecision: PostDecision = {
  action: 'POST',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  title: 'A title',
  content: 'Body.',
  reasoning: 'Thought it through.',
};

const voteDecision: VoteDecision = {
  action: 'VOTE',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  postId: 'post-1',
  decision: 'upvote',
  reasoning: 'Agreed.',
};

const commentDecision: CommentDecision = {
  action: 'COMMENT',
  worldId: 'world-1',
  memberId: 'member-1',
  characterId: 'character-1',
  postId: 'post-1',
  content: 'Same here.',
  parentCommentId: null,
  reasoning: 'Agreement.',
};

describe('SimulationLogService', () => {
  it('logs a successful POST with source, model, latency, tokens, and cost', async () => {
    const { service, repository } = createService();
    repository.create = jest.fn().mockImplementation(async (input) => ({
      ...input,
      id: 'log-1',
      executedAt: new Date(),
    }));

    await service.writeSuccess(postDecision, telemetry, 'RUN_ONE_CYCLE');

    expect(repository.create).toHaveBeenCalledWith({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'POST',
      targetId: null,
      reasoning: 'Thought it through.',
      provider: 'mock',
      model: 'fixture-model',
      latencyMs: 7,
      executionSource: 'RUN_ONE_CYCLE',
      tokensUsed: 15,
      costEstimate: 0.00003,
      status: 'SUCCESS',
      errorMessage: undefined,
    });
  });

  it('logs a vote target and a skip decision as SKIPPED', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(
      { ...voteDecision, decision: 'skip' },
      telemetry,
      'MANUAL',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VOTE',
        targetId: 'post-1',
        status: 'SKIPPED',
        executionSource: 'MANUAL',
      }),
    );
  });

  it('logs a reply against its parent comment id', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(
      { ...commentDecision, parentCommentId: 'comment-2' },
      telemetry,
      'SCHEDULED',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMMENT',
        targetId: 'comment-2',
      }),
    );
  });

  it('logs a top-level comment against its post id', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(commentDecision, telemetry, 'SCHEDULED');

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'COMMENT',
        targetId: 'post-1',
      }),
    );
  });

  it('omits tokens and cost when usage metadata is unavailable', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(
      postDecision,
      { ...telemetry, tokens: undefined },
      'RUN_ONE_CYCLE',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ tokensUsed: null, costEstimate: null }),
    );
  });

  it('prefers a provider-reported cost over the estimator', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(
      postDecision,
      { ...telemetry, costEstimateUsd: 0.999999 },
      'RUN_ONE_CYCLE',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ costEstimate: 0.999999 }),
    );
  });

  it('logs a failure with its code and message and no content fields', async () => {
    const { service, repository } = createService();

    await service.writeFailure({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'COMMENT',
      targetId: 'post-1',
      executionSource: 'RUN_ONE_CYCLE',
      provider: 'mock',
      model: 'fixture-model',
      failure: {
        code: 'COMMENT_DEPTH_EXCEEDED',
        message: 'Comments cannot be nested deeper than 3 levels',
        retryable: false,
      },
    });

    expect(repository.create).toHaveBeenCalledWith({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'COMMENT',
      targetId: 'post-1',
      provider: 'mock',
      model: 'fixture-model',
      executionSource: 'RUN_ONE_CYCLE',
      status: 'FAILED',
      errorMessage:
        'COMMENT_DEPTH_EXCEEDED: Comments cannot be nested deeper than 3 levels',
      reasoning: undefined,
      latencyMs: undefined,
      tokensUsed: undefined,
      costEstimate: undefined,
    });
  });
});
