import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationCycleService } from '@/simulation/cycle/simulation-cycle.service';

import { canonicalWorld, seedUuid } from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/aiworld';

describe('Simulation cycle (seeded database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  let cycleService: SimulationCycleService;
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

    cycleService = app.get(SimulationCycleService);
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

    const result = await cycleService.runCycle({
      worldSlug: canonicalWorld.slug,
      characterId: actorCharacterId,
      executionSource: 'RUN_ONE_CYCLE',
    });

    expect(result.status).toBe('success');
    expect(result.failure).toBeNull();
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

    const postStep = result.steps[0];
    if (postStep.status !== 'success' || postStep.step !== 'POST') {
      throw new Error('A successful POST step must report a target id');
    }
    const postId = postStep.targetId;
    createdLogIds.push(...result.steps.map((step) => step.log.id));
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
      expect(log.executionSource).toBe('RUN_ONE_CYCLE');
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

      const result = await cycleService.runCycle({
        worldSlug: canonicalWorld.slug,
        characterId: inactiveCharacterId,
        executionSource: 'RUN_ONE_CYCLE',
      });

      expect(result.status).toBe('failed');
      expect(result.failure).toMatchObject({ code: 'CHARACTER_INACTIVE' });
      expect(result.steps).toHaveLength(1);
      expect(result.steps[0]).toMatchObject({
        step: 'POST',
        status: 'failed',
      });

      const log = await prisma.simulationLog.findUniqueOrThrow({
        where: { id: result.steps[0].log.id },
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
