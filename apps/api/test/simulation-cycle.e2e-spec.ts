import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { ActionFailure } from '@/simulation/actions/simulation-action.error';
import {
  SimulationActionOutcome,
  SimulationDecision,
} from '@/simulation/actions/simulation-decision';
import { SimulationExecutionSource } from '@/simulation/domain/simulation-log';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';

import { canonicalWorld, seedUuid } from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:***@localhost:5432/aiworld';

/** Runs POST, VOTE, and COMMENT through the real test dependency graph. */
type FullCycleStep =
  | {
      step: 'POST' | 'VOTE' | 'COMMENT';
      status: 'success';
      targetId: string;
      log: SimulationLogRecord;
    }
  | {
      step: 'VOTE';
      status: 'skipped';
      targetId: null;
      log: SimulationLogRecord;
    }
  | {
      step: 'POST' | 'VOTE' | 'COMMENT';
      status: 'failed';
      targetId: null;
      failure: ActionFailure;
      log: SimulationLogRecord;
    };

async function runFullCycle(
  app: INestApplication<App>,
  input: {
    worldId: string;
    worldSlug: string;
    characterId: string;
    executionSource: SimulationExecutionSource;
  },
): Promise<FullCycleStep[]> {
  const executor = app.get(SimulationActionExecutor);
  const writer = app.get(SimulationContentWriter);
  const logService = app.get(SimulationLogService);
  const provider = app.get(LlmProvider);

  const runStep = async (
    outcome: SimulationActionOutcome,
    action: SimulationDecision['action'],
    targetId: string | null,
  ): Promise<FullCycleStep> => {
    if (outcome.status === 'failed') {
      const log = await logService.writeFailure({
        worldId: input.worldId,
        characterId: input.characterId,
        action,
        targetId,
        executionSource: input.executionSource,
        provider: provider.config.providerId,
        model: provider.config.model,
        failure: outcome.failure,
      });
      return {
        step: action,
        status: 'failed',
        targetId: null,
        failure: outcome.failure,
        log,
      };
    }

    const decision = outcome.decision;
    const persisted = await writer.persist(decision);
    const skipped = decision.action === 'VOTE' && decision.decision === 'skip';
    const log = await logService.writeSuccess(
      decision,
      outcome.telemetry,
      input.executionSource,
    );

    if (skipped) {
      return { step: 'VOTE', status: 'skipped', targetId: null, log };
    }
    if (persisted === null) {
      throw new Error('Persisting a non-skipped decision produced no row');
    }
    return {
      step: decision.action,
      status: 'success',
      targetId: persisted.id,
      log,
    };
  };

  const steps: FullCycleStep[] = [];

  const postOutcome = await executor.execute({
    action: 'POST',
    worldSlug: input.worldSlug,
    characterId: input.characterId,
  });
  const postStep = await runStep(postOutcome, 'POST', null);
  steps.push(postStep);
  if (postStep.status !== 'success') {
    return steps;
  }

  const postId = postStep.targetId;
  const voteOutcome = await executor.execute({
    action: 'VOTE',
    worldSlug: input.worldSlug,
    characterId: input.characterId,
    postId,
  });
  steps.push(await runStep(voteOutcome, 'VOTE', postId));

  const commentOutcome = await executor.execute({
    action: 'COMMENT',
    worldSlug: input.worldSlug,
    characterId: input.characterId,
    postId,
  });
  steps.push(await runStep(commentOutcome, 'COMMENT', postId));

  return steps;
}

describe('Simulation cycle (seeded database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  let worldId: string;
  const createdLogIds: string[] = [];
  const createdPostIds: string[] = [];

  const actorCharacterId = seedUuid('character:standard_procedure');
  const actorMemberId = seedUuid('member:standard_procedure');

  beforeAll(async () => {
    await seedWorld(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
    });
    worldId = world.id;
  });

  afterAll(async () => {
    await app.get(PrismaService).$disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await prisma.simulationLog.deleteMany({
      where: { id: { in: createdLogIds } },
    });
    await prisma.post.deleteMany({ where: { id: { in: createdPostIds } } });
    createdLogIds.length = 0;
    createdPostIds.length = 0;
  });

  it('creates a post, a vote, and a comment, logging one row per provider call', async () => {
    const beforePosts = await prisma.post.count({ where: { worldId } });
    const beforeLogs = await prisma.simulationLog.count({ where: { worldId } });

    const steps = await runFullCycle(app, {
      worldId,
      worldSlug: canonicalWorld.slug,
      characterId: actorCharacterId,
      executionSource: 'one-action',
    });

    expect(steps.map((step) => step.step)).toEqual(['POST', 'VOTE', 'COMMENT']);
    expect(steps.map((step) => step.status)).toEqual([
      'success',
      'success',
      'success',
    ]);

    const postStep = steps[0];
    if (postStep.status !== 'success' || postStep.step !== 'POST') {
      throw new Error('A successful POST step must report a target id');
    }
    const postId = postStep.targetId;
    createdLogIds.push(...steps.map((step) => step.log.id));
    createdPostIds.push(postId);

    const post = await prisma.post.findUniqueOrThrow({
      where: { id: postId },
    });
    expect(post.worldId).toBe(worldId);
    expect(post.authorMemberId).toBe(actorMemberId);

    const vote = await prisma.vote.findFirstOrThrow({
      where: { postId, authorMemberId: actorMemberId },
    });
    expect(vote.value).toBe(1);

    const comment = await prisma.comment.findFirstOrThrow({
      where: { postId, authorMemberId: actorMemberId },
    });
    expect(comment.parentCommentId).toBeNull();

    expect(await prisma.post.count({ where: { worldId } })).toBe(
      beforePosts + 1,
    );
    expect(await prisma.simulationLog.count({ where: { worldId } })).toBe(
      beforeLogs + 3,
    );

    const logs = await prisma.simulationLog.findMany({
      where: { id: { in: createdLogIds } },
      orderBy: { executedAt: 'asc' },
    });
    expect(logs).toHaveLength(3);
    expect(logs.map((log) => log.action)).toEqual(['POST', 'VOTE', 'COMMENT']);
    for (const log of logs) {
      expect(log.worldId).toBe(worldId);
      expect(log.characterId).toBe(actorCharacterId);
      expect(log.executionSource).toBe('ONE_ACTION');
      expect(log.status).toBe('SUCCESS');
      expect(log.provider).toBe('mock');
      expect(log.model).toBeTruthy();
      expect(log.latencyMs).toBeGreaterThan(0);
      expect(log.tokensUsed).toBeGreaterThan(0);
      expect(log.costEstimate).not.toBeNull();
    }
  });

  it('logs a failure and creates no content when the actor cannot be resolved', async () => {
    const inactiveCharacterId = seedUuid('character:inactive-cycle-test');
    await prisma.character.create({
      data: {
        id: inactiveCharacterId,
        handle: 'inactive_cycle_test',
        name: 'Inactive Cycle Test',
        biography: 'Synthetic character for the inactive-cycle failure test.',
        traits: [],
        systemPrompt: 'Synthetic.',
        isActive: false,
      },
    });

    try {
      const beforePosts = await prisma.post.count({ where: { worldId } });
      const beforeVotes = await prisma.vote.count({
        where: { post: { worldId } },
      });
      const beforeComments = await prisma.comment.count({
        where: { post: { worldId } },
      });
      const beforeLogs = await prisma.simulationLog.count({
        where: { worldId },
      });

      const steps = await runFullCycle(app, {
        worldId,
        worldSlug: canonicalWorld.slug,
        characterId: inactiveCharacterId,
        executionSource: 'one-action',
      });

      expect(steps).toHaveLength(1);
      expect(steps[0]).toMatchObject({
        step: 'POST',
        status: 'failed',
      });
      expect(steps[0].status === 'failed' && steps[0].failure).toMatchObject({
        code: 'CHARACTER_INACTIVE',
      });

      const log = await prisma.simulationLog.findUniqueOrThrow({
        where: { id: steps[0].log.id },
      });
      expect(log.status).toBe('FAILED');
      expect(log.errorMessage).toContain('CHARACTER_INACTIVE');
      expect(log.tokensUsed).toBeNull();

      expect(await prisma.post.count({ where: { worldId } })).toBe(beforePosts);
      expect(await prisma.vote.count({ where: { post: { worldId } } })).toBe(
        beforeVotes,
      );
      expect(await prisma.comment.count({ where: { post: { worldId } } })).toBe(
        beforeComments,
      );
      expect(await prisma.simulationLog.count({ where: { worldId } })).toBe(
        beforeLogs + 1,
      );
    } finally {
      await prisma.simulationLog.deleteMany({
        where: { characterId: inactiveCharacterId },
      });
      await prisma.character.delete({ where: { id: inactiveCharacterId } });
    }
  });
});
