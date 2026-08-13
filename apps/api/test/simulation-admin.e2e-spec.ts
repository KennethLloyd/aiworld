import {
  listSimulationLogsResponseSchema,
  simulationLogResponseSchema,
} from '@aiworld/shared/schemas/simulation-log.schema';
import { simulationRunResultResponseSchema } from '@aiworld/shared/schemas/simulation-run.schema';
import { simulationConfigResponseSchema } from '@aiworld/shared/schemas/simulation-state.schema';
import { simulationTelemetryResponseSchema } from '@aiworld/shared/schemas/simulation-telemetry.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationLifecycleService } from '@/simulation/lifecycle/simulation-lifecycle.service';
import { SimulationScheduler } from '@/simulation/scheduler/simulation-scheduler.port';

import { canonicalWorld } from '../prisma/seed-data';
import { seedWorld } from '../prisma/seed-world';
import { MOCK_AUTH_SESSION } from './__mocks__/nestjs-better-auth';
import type { MockAuthSessionHolder } from './__mocks__/nestjs-better-auth';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:***@localhost:5432/aiworld';

describe('Simulation admin API (e2e)', () => {
  jest.setTimeout(30000);

  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  let worldId: string;
  let worldSlug: string;
  let testStart: Date;

  const adminSession = (): void => {
    const holder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    holder.current = { user: { role: 'ADMIN' }, session: { id: 'mock' } };
  };

  const userSession = (): void => {
    const holder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    holder.current = { user: { role: 'USER' }, session: { id: 'mock' } };
  };

  const anonymous = (): void => {
    const holder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    holder.current = null;
  };

  const haltWorld = async (): Promise<void> => {
    await app.get(SimulationLifecycleService).halt(worldId);
  };

  beforeAll(async () => {
    process.env.SCHEDULER_ADAPTER = 'in-process';

    await seedWorld(prisma);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: canonicalWorld.slug },
    });
    worldId = world.id;
    worldSlug = world.slug;
  });

  afterAll(async () => {
    await app
      .get(SimulationScheduler)
      .stop(worldId)
      .catch(() => undefined);
    await app.get(PrismaService).$disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  afterEach(async () => {
    await app
      .get(SimulationScheduler)
      .stop(worldId)
      .catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 100));

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
          speedMultiplier: 1,
          intervalMs: 1800000,
          jitterMs: 300000,
        },
      })
      .catch(() => undefined);

    adminSession();
  });

  describe('authorization', () => {
    it('returns 401 without an authenticated session', async () => {
      anonymous();

      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation`)
        .expect(401)
        .expect((res) => {
          expect(res.body).toEqual({
            statusCode: 401,
            message: 'Unauthorized',
            error: 'UnauthorizedException',
          });
        });
    });

    it('returns 403 for a non-ADMIN session', async () => {
      userSession();

      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation`)
        .expect(403)
        .expect((res) => {
          expect(res.body).toEqual({
            statusCode: 403,
            message: 'Forbidden',
            error: 'ForbiddenException',
          });
        });
    });
  });

  describe('GET /simulation', () => {
    it('returns the persisted config for an ADMIN', async () => {
      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation`)
        .expect(200)
        .expect((res) => {
          expect(
            simulationConfigResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(res.body.worldId).toBe(worldId);
          expect(res.body.state).toBe('PAUSED');
        });
    });

    it('returns 404 for an unknown world', async () => {
      return request(app.getHttpServer())
        .get('/api/worlds/missing-world/simulation')
        .expect(404);
    });
  });

  describe('PATCH /simulation/state', () => {
    it('moves the lifecycle to RUNNING and back to PAUSED', async () => {
      testStart = new Date();
      await request(app.getHttpServer())
        .patch(`/api/worlds/${worldSlug}/simulation/state`)
        .send({ state: 'RUNNING' })
        .expect(200)
        .expect((res) => {
          expect(
            simulationConfigResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(res.body.state).toBe('RUNNING');
        });

      const paused = await request(app.getHttpServer())
        .patch(`/api/worlds/${worldSlug}/simulation/state`)
        .send({ state: 'PAUSED' })
        .expect(200);
      expect(paused.body.state).toBe('PAUSED');
    });

    it('returns 400 for an unknown state', async () => {
      return request(app.getHttpServer())
        .patch(`/api/worlds/${worldSlug}/simulation/state`)
        .send({ state: 'STOPPED' })
        .expect(400)
        .expect((res) => {
          expect(res.body.error).toBe('Validation Failed');
        });
    });
  });

  describe('PATCH /simulation/speed', () => {
    it('accepts a multiplier within the 0.1-100 boundary', async () => {
      testStart = new Date();
      return request(app.getHttpServer())
        .patch(`/api/worlds/${worldSlug}/simulation/speed`)
        .send({ speedMultiplier: 2 })
        .expect(200)
        .expect((res) => {
          expect(
            simulationConfigResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(res.body.speedMultiplier).toBe(2);
        });
    });

    it.each([0, 0.09, 101, 'fast'])(
      'returns 400 for out-of-range multiplier %s',
      (speedMultiplier) => {
        return request(app.getHttpServer())
          .patch(`/api/worlds/${worldSlug}/simulation/speed`)
          .send({ speedMultiplier })
          .expect(400)
          .expect((res) => {
            expect(res.body.error).toBe('Validation Failed');
          });
      },
    );
  });

  describe('POST /simulation/run-one-action', () => {
    it('runs one scheduler iteration and returns the logged outcome', async () => {
      testStart = new Date();

      return request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/run-one-action`)
        .expect(200)
        .expect((res) => {
          expect(
            simulationRunResultResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(['success', 'failed']).toContain(res.body.status);
          expect(res.body.log.executionSource).toBe('one-action');
          expect(
            simulationLogResponseSchema.safeParse(res.body.log).success,
          ).toBe(true);
        });
    });
  });

  describe('POST /simulation/custom-action', () => {
    it('composes a forced POST and returns the logged outcome', async () => {
      testStart = new Date();

      return request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ actionType: 'POST' })
        .expect(200)
        .expect((res) => {
          expect(
            simulationRunResultResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(res.body.status).toBe('success');
          expect(res.body.log.executionSource).toBe('custom');
          expect(res.body.log.status).toBe('SUCCESS');
        });
    });

    it('returns 400 for an unknown action type', async () => {
      return request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ actionType: 'DELETE' })
        .expect(400);
    });
  });

  describe('HALTED refusal at the HTTP boundary', () => {
    it('rejects manual work with 409 while the world is HALTED', async () => {
      testStart = new Date();
      await haltWorld();

      await request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/run-one-action`)
        .expect(409)
        .expect((res) => {
          expect(res.body.statusCode).toBe(409);
          expect(res.body.message).toContain('HALTED');
        });

      await request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ actionType: 'POST' })
        .expect(409);
    });

    it('still serves configuration and telemetry while HALTED', async () => {
      testStart = new Date();
      await haltWorld();

      await request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation`)
        .expect(200)
        .expect((res) => {
          expect(res.body.state).toBe('HALTED');
        });

      await request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/telemetry`)
        .expect(200);
    });
  });

  describe('GET /simulation/telemetry', () => {
    it('returns aggregates without provider secrets', async () => {
      testStart = new Date();
      await request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ actionType: 'POST' })
        .expect(200);

      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/telemetry`)
        .expect(200)
        .expect((res) => {
          expect(
            simulationTelemetryResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(res.body.worldId).toBe(worldId);
          expect(res.body.totalRuns).toBeGreaterThanOrEqual(1);
          expect('provider' in res.body).toBe(false);
        });
    });
  });

  describe('GET /simulation/logs', () => {
    it('returns a paginated list matching the shared schema', async () => {
      testStart = new Date();
      await request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ actionType: 'POST' })
        .expect(200);

      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/logs`)
        .expect(200)
        .expect((res) => {
          expect(
            listSimulationLogsResponseSchema.safeParse(res.body).success,
          ).toBe(true);
          expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
        });
    });

    it('filters by execution source', async () => {
      testStart = new Date();
      await request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ actionType: 'POST' })
        .expect(200);

      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/logs`)
        .query({ executionSource: 'custom' })
        .expect(200)
        .expect((res) => {
          expect(res.body.meta.total).toBeGreaterThanOrEqual(1);
          for (const log of res.body.items) {
            expect(log.executionSource).toBe('custom');
          }
        });
    });

    it('filters by character, action, and status', async () => {
      testStart = new Date();
      const member = await prisma.worldMember.findFirstOrThrow({
        where: { worldId, isActive: true },
      });

      await request(app.getHttpServer())
        .post(`/api/worlds/${worldSlug}/simulation/custom-action`)
        .send({ characterId: member.characterId, actionType: 'POST' })
        .expect(200);

      const byCharacter = await request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/logs`)
        .query({ characterId: member.characterId })
        .expect(200);
      expect(byCharacter.body.meta.total).toBeGreaterThanOrEqual(1);
      for (const log of byCharacter.body.items) {
        expect(log.characterId).toBe(member.characterId);
      }

      const byAction = await request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/logs`)
        .query({ action: 'POST' })
        .expect(200);
      expect(byAction.body.meta.total).toBeGreaterThanOrEqual(1);
      for (const log of byAction.body.items) {
        expect(log.action).toBe('POST');
      }

      const byStatus = await request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/logs`)
        .query({ status: 'SUCCESS' })
        .expect(200);
      expect(byStatus.body.meta.total).toBeGreaterThanOrEqual(1);
      for (const log of byStatus.body.items) {
        expect(log.status).toBe('SUCCESS');
      }
    });

    it('returns 400 for an invalid filter value', async () => {
      return request(app.getHttpServer())
        .get(`/api/worlds/${worldSlug}/simulation/logs`)
        .query({ executionSource: 'batch' })
        .expect(400);
    });
  });
});
