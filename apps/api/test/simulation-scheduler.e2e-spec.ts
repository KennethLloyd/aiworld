import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { Job, Queue, Worker } from 'bullmq';
import { Redis as IORedis } from 'ioredis';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationAdminService } from '@/simulation/admin/simulation-admin.service';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SIMULATION_TICKS_QUEUE } from '@/simulation/scheduler/bullmq-scheduler.adapter';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';

import { canonicalWorld, seedUuid } from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:***@localhost:5432/aiworld';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

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

function reconciliationFixture(key: string) {
  return {
    worldId: seedUuid(`world:scheduler-reconciliation:${key}`),
    worldSlug: `scheduler-reconciliation-${key}`,
    characterId: seedUuid(`character:scheduler-reconciliation:${key}`),
    memberId: seedUuid(`member:scheduler-reconciliation:${key}`),
  };
}

async function deleteReconciliationFixture(
  prisma: PrismaClient,
  fixture: ReturnType<typeof reconciliationFixture>,
): Promise<void> {
  await prisma.vote.deleteMany({
    where: {
      OR: [
        { post: { worldId: fixture.worldId } },
        { comment: { post: { worldId: fixture.worldId } } },
      ],
    },
  });
  await prisma.world.deleteMany({ where: { id: fixture.worldId } });
  await prisma.character.deleteMany({ where: { id: fixture.characterId } });
}

async function createReconciliationFixture(
  prisma: PrismaClient,
  key: string,
  memberActive = true,
): Promise<ReturnType<typeof reconciliationFixture>> {
  const fixture = reconciliationFixture(key);
  await deleteReconciliationFixture(prisma, fixture);
  await prisma.world.create({
    data: {
      id: fixture.worldId,
      name: `Scheduler Reconciliation ${key}`,
      slug: fixture.worldSlug,
      description: { about: 'A scheduler reconciliation fixture.' },
      rules: [],
      topicScope: 'Scheduler tests',
      isActive: true,
    },
  });
  await prisma.character.create({
    data: {
      id: fixture.characterId,
      handle: `scheduler_reconciliation_${key.replaceAll('-', '_')}`,
      name: `Scheduler Reconciliation ${key}`,
      biography: 'A resident used by scheduler reconciliation tests.',
      traits: [],
      systemPrompt: 'You are a scheduler reconciliation test resident.',
      isActive: true,
    },
  });
  await prisma.worldMember.create({
    data: {
      id: fixture.memberId,
      worldId: fixture.worldId,
      characterId: fixture.characterId,
      role: 'AI',
      isActive: memberActive,
    },
  });
  await prisma.worldSimulationConfig.create({
    data: {
      worldId: fixture.worldId,
      state: 'RUNNING',
      intervalMs: 1_800_000,
      jitterMs: 0,
      speedMultiplier: 1,
      actionWeights: { POST: 1, VOTE: 0, COMMENT: 0 },
    },
  });
  return fixture;
}

async function ticksForWorld(queue: Queue, worldId: string): Promise<Job[]> {
  const jobs = await queue.getJobs([
    'active',
    'waiting',
    'delayed',
    'prioritized',
  ]);
  return jobs.filter((job) => job.name === `tick_${worldId}`);
}

async function removeTicksForWorld(
  queue: Queue,
  worldId: string,
): Promise<void> {
  const jobs = await ticksForWorld(queue, worldId);
  await Promise.all(jobs.map((job) => job.remove().catch(() => undefined)));
}

describe('Simulation scheduler (BullMQ adapter, e2e)', () => {
  jest.setTimeout(60000);

  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  let worldId: string;
  let scheduler: SimulationScheduler;
  let queue: Queue;
  let queueConnection: IORedis;
  let testStart: Date;

  beforeAll(async () => {
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
    queueConnection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    queue = new Queue(SIMULATION_TICKS_QUEUE, {
      connection: queueConnection,
    });

    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
    });
    worldId = world.id;
  });

  afterAll(async () => {
    await scheduler.stop(worldId).catch(() => undefined);
    await app.close();
    await queue.close();
    await queueConnection.quit();
    await app.get(PrismaService).$disconnect();
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

      // Multiple ticks should fire and persist at least one POST.
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

      // Pausing removes future work while admitted work may finish.
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

  it('repairs stranded ticks, isolates Worlds, and remains idempotent across API processes', async () => {
    const first = await createReconciliationFixture(prisma, 'first');
    const second = await createReconciliationFixture(prisma, 'second');
    let secondApp: INestApplication | undefined;

    try {
      await removeTicksForWorld(queue, first.worldId);
      await removeTicksForWorld(queue, second.worldId);

      const secondModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      secondApp = secondModule.createNestApplication();
      await secondApp.init();
      const secondScheduler = secondApp.get(SimulationScheduler);

      await Promise.all([
        scheduler.ensureScheduled(first.worldId),
        secondScheduler.ensureScheduled(first.worldId),
        scheduler.ensureScheduled(second.worldId),
      ]);

      await waitFor(
        async () =>
          (await ticksForWorld(queue, first.worldId)).length === 1 &&
          (await ticksForWorld(queue, second.worldId)).length === 1,
        5000,
      );

      expect(await ticksForWorld(queue, first.worldId)).toHaveLength(1);
      expect(await ticksForWorld(queue, second.worldId)).toHaveLength(1);

      await removeTicksForWorld(queue, first.worldId);
      expect(await ticksForWorld(queue, first.worldId)).toHaveLength(0);
      expect(await ticksForWorld(queue, second.worldId)).toHaveLength(1);

      await scheduler.ensureScheduled(first.worldId);

      await waitFor(
        async () => (await ticksForWorld(queue, first.worldId)).length === 1,
        5000,
      );
      expect(await ticksForWorld(queue, first.worldId)).toHaveLength(1);
      expect(await ticksForWorld(queue, second.worldId)).toHaveLength(1);
    } finally {
      await removeTicksForWorld(queue, first.worldId);
      await removeTicksForWorld(queue, second.worldId);
      await deleteReconciliationFixture(prisma, first);
      await deleteReconciliationFixture(prisma, second);
      await secondApp?.close();
    }
  });

  it('keeps only the latest delayed successor while a Tick is active', async () => {
    const queueName = `${SIMULATION_TICKS_QUEUE}-deduplication-test`;
    const testQueue = new Queue(queueName, { connection: queueConnection });
    const workerConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
    });
    let releaseActiveJob!: () => void;
    const activeJobFinished = new Promise<void>((resolve) => {
      releaseActiveJob = resolve;
    });
    const worker = new Worker(queueName, async () => activeJobFinished, {
      connection: workerConnection,
    });
    const deduplicationId = `deduplication-test-${Date.now()}`;

    try {
      const first = await testQueue.add(
        'tick',
        { sequence: 1 },
        {
          deduplication: { id: deduplicationId, keepLastIfActive: true },
        },
      );
      await waitFor(async () => (await first.getState()) === 'active', 5000);

      const deduplicated = await testQueue.add(
        'tick',
        { sequence: 2 },
        {
          delay: 60_000,
          deduplication: { id: deduplicationId, keepLastIfActive: true },
        },
      );
      expect(deduplicated.id).toBe(first.id);

      releaseActiveJob();
      await waitFor(async () => {
        const successorId =
          await testQueue.getDeduplicationJobId(deduplicationId);
        return successorId !== null && successorId !== first.id;
      }, 5000);

      const successorId =
        await testQueue.getDeduplicationJobId(deduplicationId);
      const successor = await testQueue.getJob(successorId!);
      expect(successor?.data).toEqual({ sequence: 2 });
    } finally {
      releaseActiveJob();
      await worker.close();
      await testQueue.obliterate({ force: true });
      await testQueue.close();
      await workerConnection.quit();
    }
  });

  it('blocks a RUNNING World without active AI Residents and recovers on reconciliation', async () => {
    const fixture = await createReconciliationFixture(
      prisma,
      'no-residents',
      false,
    );

    try {
      await scheduler.ensureScheduled(fixture.worldId);

      await expect(
        scheduler.getObservability(fixture.worldId),
      ).resolves.toMatchObject({
        pending: false,
        workExpected: false,
        blockedReason: 'NO_ACTIVE_RESIDENTS',
      });
      await expect(
        prisma.worldSimulationConfig.findUniqueOrThrow({
          where: { worldId: fixture.worldId },
        }),
      ).resolves.toMatchObject({ state: 'RUNNING' });
      expect(await ticksForWorld(queue, fixture.worldId)).toHaveLength(0);
      await expect(
        app.get(SimulationAdminService).getHealth(fixture.worldSlug),
      ).resolves.toMatchObject({
        health: { status: 'DEGRADED' },
        scheduler: { blockedReason: 'NO_ACTIVE_RESIDENTS' },
      });

      await prisma.worldMember.update({
        where: { id: fixture.memberId },
        data: { isActive: true },
      });
      await scheduler.ensureScheduled(fixture.worldId);

      await waitFor(
        async () => (await ticksForWorld(queue, fixture.worldId)).length === 1,
        5000,
      );
      await expect(
        scheduler.getObservability(fixture.worldId),
      ).resolves.toMatchObject({
        pending: true,
        workExpected: true,
        blockedReason: null,
      });
      await expect(
        app.get(SimulationAdminService).getHealth(fixture.worldSlug),
      ).resolves.toMatchObject({
        health: { status: 'HEALTHY' },
        scheduler: { blockedReason: null },
      });
    } finally {
      await removeTicksForWorld(queue, fixture.worldId);
      await deleteReconciliationFixture(prisma, fixture);
    }
  });

  it('recovers scheduler health after a later scheduled success without clearing dead-letter history', async () => {
    const fixture = await createReconciliationFixture(
      prisma,
      'health-recovery',
    );

    try {
      await scheduler.ensureScheduled(fixture.worldId);
      const deadLetterAt = new Date(Date.now() - 60_000);
      await prisma.simulationRuntimeState.update({
        where: { worldId: fixture.worldId },
        data: {
          deadLetterCount: 1,
          lastDeadLetterAt: deadLetterAt,
          lastDeadLetterReason: 'Redis unavailable',
        },
      });
      await prisma.simulationLog.create({
        data: {
          worldId: fixture.worldId,
          characterId: fixture.characterId,
          action: 'POST',
          provider: 'mock',
          model: 'fixture-model',
          executionSource: 'SCHEDULED',
          status: 'SUCCESS',
          providerFailure: false,
        },
      });

      const health = await app
        .get(SimulationAdminService)
        .getHealth(fixture.worldSlug);

      expect(health.scheduler.deadLetterCount).toBe(1);
      expect(health.health).toEqual({ status: 'HEALTHY', reason: null });
    } finally {
      await removeTicksForWorld(queue, fixture.worldId);
      await deleteReconciliationFixture(prisma, fixture);
    }
  });

  it('repairs a RUNNING World during startup reconciliation', async () => {
    const fixture = await createReconciliationFixture(prisma, 'startup');
    let secondApp: INestApplication | undefined;

    try {
      await removeTicksForWorld(queue, fixture.worldId);
      const secondModule = await Test.createTestingModule({
        imports: [AppModule],
      }).compile();
      secondApp = secondModule.createNestApplication();
      await secondApp.init();

      await waitFor(
        async () => (await ticksForWorld(queue, fixture.worldId)).length === 1,
        5000,
      );
      expect(await ticksForWorld(queue, fixture.worldId)).toHaveLength(1);
    } finally {
      await removeTicksForWorld(queue, fixture.worldId);
      await deleteReconciliationFixture(prisma, fixture);
      await secondApp?.close();
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
    // Random manual picks may persist or skip an already-voted target.
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
