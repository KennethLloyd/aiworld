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

    await service.writeSuccess(postDecision, telemetry, 'one-action');

    expect(repository.create).toHaveBeenCalledWith({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'POST',
      targetId: null,
      reasoning: 'Thought it through.',
      provider: 'mock',
      model: 'fixture-model',
      latencyMs: 7,
      jobId: null,
      executionSource: 'one-action',
      tokensUsed: 15,
      costEstimate: 0.00003,
      status: 'SUCCESS',
      errorMessage: undefined,
    });
  });

  it('records the queue job id when provided', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(postDecision, telemetry, 'scheduled', 'job-1');

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-1', executionSource: 'scheduled' }),
    );
  });

  it('logs a vote target and a skip decision as SKIPPED', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(
      { ...voteDecision, decision: 'skip' },
      telemetry,
      'custom',
    );

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'VOTE',
        targetId: 'post-1',
        status: 'SKIPPED',
        executionSource: 'custom',
      }),
    );
  });

  it('logs a reply against its parent comment id', async () => {
    const { service, repository } = createService();

    await service.writeSuccess(
      { ...commentDecision, parentCommentId: 'comment-2' },
      telemetry,
      'scheduled',
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

    await service.writeSuccess(commentDecision, telemetry, 'scheduled');

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
      'one-action',
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
      'one-action',
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
      executionSource: 'one-action',
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
      executionSource: 'one-action',
      jobId: null,
      status: 'FAILED',
      errorMessage:
        'COMMENT_DEPTH_EXCEEDED: Comments cannot be nested deeper than 3 levels',
      reasoning: undefined,
      latencyMs: undefined,
      tokensUsed: undefined,
      costEstimate: undefined,
    });
  });

  it('records the queue job id on a failed attempt', async () => {
    const { service, repository } = createService();

    await service.writeFailure({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'POST',
      executionSource: 'scheduled',
      provider: 'mock',
      model: 'fixture-model',
      failure: {
        code: 'TIMEOUT',
        message: 'Provider request timed out',
        retryable: true,
      },
      jobId: 'job-7',
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({ jobId: 'job-7', status: 'FAILED' }),
    );
  });

  it('logs a lifecycle rejection as REJECTED with the reason', async () => {
    const { service, repository } = createService();

    await service.writeRejected({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'VOTE',
      executionSource: 'scheduled',
      provider: 'mock',
      model: 'fixture-model',
      reason: 'Scheduled work is not allowed while PAUSED',
      jobId: 'job-9',
    });

    expect(repository.create).toHaveBeenCalledWith({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'VOTE',
      provider: 'mock',
      model: 'fixture-model',
      executionSource: 'scheduled',
      jobId: 'job-9',
      status: 'REJECTED',
      errorMessage: 'Scheduled work is not allowed while PAUSED',
    });
  });
});
