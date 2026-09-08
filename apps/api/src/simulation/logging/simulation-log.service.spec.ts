import { PrismaService } from '@/lib/database/prisma.service';
import {
  CommentDecision,
  PostDecision,
  VoteDecision,
} from '@/simulation/actions/simulation-decision';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';

import { SimulationLogService } from './simulation-log.service';

const telemetry = {
  source: 'mock',
  model: 'fixture-model',
  latencyMs: 7,
  tokens: { prompt: 10, completion: 5, total: 15 },
};
const dbLog = {
  id: 'log-1',
  worldId: 'world-1',
  characterId: 'character-1',
  action: 'POST' as const,
  targetId: null,
  reasoning: 'Thought it through.',
  provider: 'mock',
  model: 'fixture-model',
  latencyMs: 7,
  jobId: null,
  executionSource: 'ONE_ACTION' as const,
  tokensUsed: 15,
  costEstimate: 0.00003,
  status: 'SUCCESS' as const,
  errorMessage: null,
  providerFailure: false,
  executedAt: new Date('2026-08-13'),
};

function createService() {
  const prisma = { simulationLog: { create: jest.fn() } };
  const costEstimator = new SimulationCostEstimator({
    inputPerMillionUsd: 1,
    outputPerMillionUsd: 4,
  });
  const service = new SimulationLogService(
    prisma as unknown as PrismaService,
    costEstimator,
  );
  prisma.simulationLog.create.mockResolvedValue(dbLog);
  return { service, prisma };
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
    const { service, prisma } = createService();
    await service.writeSuccess(postDecision, telemetry, 'one-action');

    expect(prisma.simulationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'POST',
        targetId: null,
        executionSource: 'ONE_ACTION',
        tokensUsed: 15,
        costEstimate: 0.00003,
        status: 'SUCCESS',
      }),
    });
  });

  it('maps vote skips and comment targets', async () => {
    const { service, prisma } = createService();
    await service.writeSuccess(
      { ...voteDecision, decision: 'skip' },
      telemetry,
      'custom',
    );
    expect(prisma.simulationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'VOTE',
        targetId: 'post-1',
        status: 'SKIPPED',
        executionSource: 'CUSTOM',
      }),
    });

    await service.writeSuccess(
      { ...commentDecision, parentCommentId: 'comment-2' },
      telemetry,
      'scheduled',
    );
    expect(prisma.simulationLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        action: 'COMMENT',
        targetId: 'comment-2',
        executionSource: 'SCHEDULED',
      }),
    });
  });

  it('omits usage values when metadata is unavailable and prefers provider cost', async () => {
    const { service, prisma } = createService();
    await service.writeSuccess(
      postDecision,
      { ...telemetry, tokens: undefined },
      'one-action',
    );
    expect(prisma.simulationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tokensUsed: null, costEstimate: null }),
    });

    await service.writeSuccess(
      postDecision,
      { ...telemetry, costEstimateUsd: 0.999999 },
      'one-action',
    );
    expect(prisma.simulationLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({ costEstimate: 0.999999 }),
    });
  });

  it('logs failures and lifecycle rejections without content fields', async () => {
    const { service, prisma } = createService();
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
        message: 'Too deep',
        retryable: false,
      },
    });
    expect(prisma.simulationLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: 'FAILED',
        errorMessage: 'COMMENT_DEPTH_EXCEEDED: Too deep',
      }),
    });

    await service.writeRejected({
      worldId: 'world-1',
      characterId: 'character-1',
      action: 'VOTE',
      executionSource: 'scheduled',
      provider: 'mock',
      model: 'fixture-model',
      reason: 'Paused',
      jobId: 'job-9',
    });
    expect(prisma.simulationLog.create).toHaveBeenLastCalledWith({
      data: expect.objectContaining({
        status: 'REJECTED',
        errorMessage: 'Paused',
        jobId: 'job-9',
      }),
    });
  });
});
