import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';

import { canonicalWorld, seedUuid } from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:***@localhost:5432/aiworld';

async function waitFor(
  predicate: () => Promise<boolean>,
  timeoutMs: number,
  diagnostics?: () => Promise<string>,
): Promise<void> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const details = diagnostics ? `: ${await diagnostics()}` : '';
  throw new Error(`Timed out waiting for condition${details}`);
}

const emptyWorldFixture = {
  worldId: seedUuid('world:scheduler-empty-world'),
  worldSlug: 'scheduler-empty-world',
  characterId: seedUuid('character:scheduler-empty-world'),
  memberId: seedUuid('member:scheduler-empty-world'),
};

async function deleteEmptyWorldFixture(prisma: PrismaClient): Promise<void> {
  await prisma.vote.deleteMany({
    where: {
      OR: [
        { post: { worldId: emptyWorldFixture.worldId } },
        { comment: { post: { worldId: emptyWorldFixture.worldId } } },
      ],
    },
  });
  await prisma.world.deleteMany({
    where: { id: emptyWorldFixture.worldId },
  });
  await prisma.character.deleteMany({
    where: { id: emptyWorldFixture.characterId },
  });
}

async function createEmptyWorldFixture(prisma: PrismaClient): Promise<void> {
  await deleteEmptyWorldFixture(prisma);
  await prisma.world.create({
    data: {
      id: emptyWorldFixture.worldId,
      name: 'Scheduler Empty World',
      slug: emptyWorldFixture.worldSlug,
      description: { about: 'A scheduler cadence regression fixture.' },
      rules: [],
      topicScope: 'Scheduler tests',
      isActive: true,
    },
  });
  await prisma.character.create({
    data: {
      id: emptyWorldFixture.characterId,
      handle: 'scheduler_empty_world',
      name: 'Scheduler Empty World Resident',
      biography: 'A resident used by the scheduler cadence regression test.',
      traits: [],
      systemPrompt: 'You are a scheduler regression-test resident.',
      isActive: true,
    },
  });
  await prisma.worldMember.create({
    data: {
      id: emptyWorldFixture.memberId,
      worldId: emptyWorldFixture.worldId,
      characterId: emptyWorldFixture.characterId,
      role: 'AI',
      isActive: true,
    },
  });
  await prisma.worldSimulationConfig.create({
    data: {
      worldId: emptyWorldFixture.worldId,
      state: 'RUNNING',
      intervalMs: 200,
      jitterMs: 0,
      speedMultiplier: 1,
      actionWeights: { POST: 0, VOTE: 1, COMMENT: 0 },
    },
  });
}

describe('Simulation scheduler (BullMQ adapter, e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  let worldId: string;
  let scheduler: SimulationScheduler;
  let testStart: Date;

  beforeAll(async () => {
    process.env.SCHEDULER_ADAPTER = 'bullmq';
    process.env.REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
    process.env.LLM_PROVIDER = 'mock';
    process.env.LLM_MODEL = 'fixture-model';

    await seedWorld(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
    scheduler = app.get(SimulationScheduler);

    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
    });
    worldId = world.id;
  });

  afterAll(async () => {
    await scheduler.stop(worldId).catch(() => undefined);
    await app.get(PrismaService).$disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  const scheduledLogsSinceTestStart = () =>
    prisma.simulationLog.findMany({
      where: {
        worldId,
        executionSource: 'SCHEDULED',
        executedAt: { gt: testStart },
      },
      orderBy: { executedAt: 'asc' },
    });

  const pauseWorld = async (): Promise<void> => {
    await scheduler.stop(worldId);
    await prisma.worldSimulationConfig.update({
      where: { worldId },
      data: { state: 'PAUSED' },
    });
  };

  it('starts scheduled ticks that fire, persist content, and self-reschedule; stop halts them', async () => {
    testStart = new Date();

    await prisma.worldSimulationConfig.update({
      where: { worldId },
      data: {
        state: 'RUNNING',
        intervalMs: 2000,
        jitterMs: 0,
        speedMultiplier: 100,
        actionWeights: { POST: 1, VOTE: 0, COMMENT: 0 },
      },
    });

    try {
      await scheduler.start(worldId);

      // Completion-to-start cadence: multiple ticks fire back to back, and at
      // least one of them is a POST so content is actually persisted.
      await waitFor(
        async () => {
          const logs = await scheduledLogsSinceTestStart();
          return (
            logs.filter((log) => log.status === 'SUCCESS').length >= 2 &&
            logs.some(
              (log) => log.status === 'SUCCESS' && log.action === 'POST',
            )
          );
        },
        30000,
        async () => {
          const logs = await scheduledLogsSinceTestStart();
          return JSON.stringify(
            logs.map(({ action, status, errorMessage, executedAt }) => ({
              action,
              status,
              errorMessage,
              executedAt,
            })),
          );
        },
      );

      const logs = (await scheduledLogsSinceTestStart()).slice(0, 2);
      expect(logs).toHaveLength(2);
      for (const log of logs) {
        expect(log.jobId).toBeTruthy();
      }
      expect(logs.every((log) => log.status === 'SUCCESS')).toBe(true);

      const posts = await prisma.post.findMany({
        where: { worldId, createdAt: { gt: testStart } },
      });
      expect(posts.length).toBeGreaterThan(0);

      // Lifecycle pause drives stop() and leaves RUNNING, so in-flight ticks
      // are rejected by the gate and no further ticks fire.
      await app.get(SimulationLifecycleService).pause(worldId);
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const afterStop = (await scheduledLogsSinceTestStart()).length;
      await new Promise((resolve) => setTimeout(resolve, 1500));
      expect((await scheduledLogsSinceTestStart()).length).toBe(afterStop);
    } finally {
      await pauseWorld();
    }
  });

  it('keeps an empty World cadence alive by forcing POST when its weight is zero', async () => {
    await createEmptyWorldFixture(prisma);

    try {
      await scheduler.start(emptyWorldFixture.worldId);

      await waitFor(
        async () =>
          (await prisma.simulationLog.count({
            where: {
              worldId: emptyWorldFixture.worldId,
              executionSource: 'SCHEDULED',
            },
          })) >= 2,
        30000,
        async () =>
          JSON.stringify(
            await prisma.simulationLog.findMany({
              where: {
                worldId: emptyWorldFixture.worldId,
                executionSource: 'SCHEDULED',
              },
              orderBy: { executedAt: 'asc' },
              select: { action: true, status: true, errorMessage: true },
            }),
          ),
      );

      const logs = await prisma.simulationLog.findMany({
        where: {
          worldId: emptyWorldFixture.worldId,
          executionSource: 'SCHEDULED',
        },
        orderBy: { executedAt: 'asc' },
      });
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs[0]).toMatchObject({ action: 'POST', status: 'SUCCESS' });
      expect(logs[1]?.status).toBe('SUCCESS');
      expect(
        await prisma.post.count({
          where: { worldId: emptyWorldFixture.worldId },
        }),
      ).toBeGreaterThanOrEqual(1);

      await waitFor(
        async () =>
          (await scheduler.getObservability(emptyWorldFixture.worldId)).pending,
        5000,
      );
      await expect(
        scheduler.getObservability(emptyWorldFixture.worldId),
      ).resolves.toMatchObject({
        pending: true,
        deadLetterCount: 0,
      });
    } finally {
      await scheduler.stop(emptyWorldFixture.worldId).catch(() => undefined);
      await deleteEmptyWorldFixture(prisma);
    }
  });

  it('runOneAction runs the scheduler task once and awaits the result', async () => {
    testStart = new Date();

    const result = await scheduler.runOneAction(canonicalWorld.slug);

    expect(result.status).toBe('success');
    const log = await prisma.simulationLog.findUniqueOrThrow({
      where: { id: result.log.id },
    });
    expect(log.executionSource).toBe('ONE_ACTION');
    // A manual iteration picks a random resident and action, so the log is
    // SUCCESS for a persisted action or SKIPPED when the resident already
    // voted on the picked target — both are completed runs.
    expect(['SUCCESS', 'SKIPPED']).toContain(log.status);
    expect(log.jobId).toBeNull();
  });

  it('runCustomAction composes a forced action and awaits the result', async () => {
    testStart = new Date();

    const result = await scheduler.runCustomAction({
      worldSlug: canonicalWorld.slug,
      actionType: 'POST',
    });

    expect(result.status).toBe('success');
    const log = await prisma.simulationLog.findUniqueOrThrow({
      where: { id: result.log.id },
    });
    expect(log.executionSource).toBe('CUSTOM');
    expect(log.status).toBe('SUCCESS');
  });

  afterEach(async () => {
    await scheduler.stop(worldId).catch(() => undefined);
    // Let an in-flight tick finish before cleaning so nothing leaks across
    // tests.
    await new Promise((resolve) => setTimeout(resolve, 200));

    // Ticks target seeded posts too, so comments and votes created during the
    // test window must be removed from both new and seeded content.
    const postIds = (
      await prisma.post.findMany({
        where: { worldId, createdAt: { gt: testStart } },
        select: { id: true },
      })
    ).map((post) => post.id);
    const commentIds = (
      await prisma.comment.findMany({
        where: { post: { worldId }, createdAt: { gt: testStart } },
        select: { id: true },
      })
    ).map((comment) => comment.id);

    await prisma.vote.deleteMany({
      where: {
        OR: [{ postId: { in: postIds } }, { commentId: { in: commentIds } }],
      },
    });
    await prisma.comment.deleteMany({ where: { id: { in: commentIds } } });
    await prisma.post.deleteMany({ where: { id: { in: postIds } } });
    await prisma.simulationLog.deleteMany({
      where: { worldId, executedAt: { gt: testStart } },
    });

    await prisma.worldSimulationConfig
      .update({
        where: { worldId },
        data: {
          state: 'PAUSED',
          intervalMs: 1800000,
          jitterMs: 300000,
          speedMultiplier: 1,
        },
      })
      .catch(() => undefined);
  });
});
