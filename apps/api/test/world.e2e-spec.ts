import {
  listWorldsResponseSchema,
  worldResponseSchema,
} from '@aiworld/shared/schemas/world-response.schema';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaService } from '@/lib/database/prisma.service';
import { WorldRecord } from '@/world/domain/world-record';

import { MOCK_AUTH_SESSION } from './__mocks__/nestjs-better-auth';
import type { MockAuthSessionHolder } from './__mocks__/nestjs-better-auth';

describe('Worlds API (e2e)', () => {
  let app: INestApplication<App>;

  const mbtiWorldRecord: WorldRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'MBTI Discussion',
    slug: 'mbti',
    description: { about: 'A community for MBTI enthusiasts' },
    rules: ['Keep discussions civil.', 'Stay on MBTI topic.'],
    topicScope: 'MBTI theory, personality types, cognitive functions',
    residentCount: 16,
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const createdWorldRecord: WorldRecord = {
    id: '00000000-0000-4000-8000-000000000002',
    name: 'New World',
    slug: 'new-world',
    description: { about: 'A brand new world' },
    rules: ['Rule one', 'Rule two'],
    topicScope: 'Anything goes',
    residentCount: 0,
    isActive: true,
    createdAt: new Date('2026-08-01T12:00:00.000Z'),
    updatedAt: new Date('2026-08-01T12:00:00.000Z'),
  };

  const updatedWorldRecord: WorldRecord = {
    ...mbtiWorldRecord,
    name: 'MBTI Discussion (updated)',
    updatedAt: new Date('2026-08-02T00:00:00.000Z'),
  };

  // Infrastructure-boundary stub replacing PrismaService. PrismaWorldRepository
  // only touches world.findMany/findUnique/count/create/update/delete, so the
  // stub exposes exactly those methods. findUnique returns the MBTI fixture for
  // the 'mbti' slug and null for every other slug, covering both the existing
  // and missing-slug code paths.
  const prismaStub = {
    world: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    prismaStub.world.findMany.mockResolvedValue([mbtiWorldRecord]);
    prismaStub.world.count.mockResolvedValue(1);
    prismaStub.world.findUnique.mockImplementation(
      (args: { where: { slug: string } }) =>
        Promise.resolve(
          args.where.slug === mbtiWorldRecord.slug ? mbtiWorldRecord : null,
        ),
    );
    prismaStub.world.create.mockResolvedValue(createdWorldRecord);
    prismaStub.world.update.mockResolvedValue(updatedWorldRecord);
    prismaStub.world.delete.mockResolvedValue(undefined);

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();

    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = {
      user: { role: 'ADMIN' },
      session: { id: 'mock-session' },
    };
  });

  afterEach(async () => {
    await app.close();
  });

  it('GET /api/worlds returns 200 with a body matching listWorldsResponseSchema', () => {
    return request(app.getHttpServer())
      .get('/api/worlds')
      .expect(200)
      .expect((res) => {
        expect(listWorldsResponseSchema.safeParse(res.body).success).toBe(true);
      });
  });

  it('GET /api/worlds/mbti returns 200 with a body matching worldResponseSchema', () => {
    return request(app.getHttpServer())
      .get('/api/worlds/mbti')
      .expect(200)
      .expect((res) => {
        expect(worldResponseSchema.safeParse(res.body).success).toBe(true);
      });
  });

  it('GET /api/worlds/missing returns 404 with the normalized exception envelope', () => {
    return request(app.getHttpServer())
      .get('/api/worlds/missing')
      .expect(404)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 404,
          message: 'Not Found',
          error: 'NotFoundException',
        });
      });
  });

  it('POST /api/worlds with a valid payload returns 201 with a body matching worldResponseSchema', () => {
    return request(app.getHttpServer())
      .post('/api/worlds')
      .send({
        name: 'New World',
        slug: 'new-world',
        description: { about: 'A brand new world' },
        rules: ['Rule one', 'Rule two'],
        topicScope: 'Anything goes',
      })
      .expect(201)
      .expect((res) => {
        expect(worldResponseSchema.safeParse(res.body).success).toBe(true);
      });
  });

  it('POST /api/worlds with an invalid slug returns 400 with Zod issues and error "Validation Failed"', () => {
    return request(app.getHttpServer())
      .post('/api/worlds')
      .send({
        name: 'Invalid Slug World',
        slug: 'Invalid Slug!',
        rules: [],
        topicScope: 'Validation test',
      })
      .expect(400)
      .expect((res) => {
        expect(res.body.error).toBe('Validation Failed');
        expect(Array.isArray(res.body.message)).toBe(true);
        expect(res.body.message.length).toBeGreaterThan(0);
        expect(res.body.message[0]).toEqual(
          expect.objectContaining({
            code: expect.any(String),
            path: expect.any(Array),
            message: expect.any(String),
          }),
        );
      });
  });

  it('PATCH /api/worlds/mbti returns 200 with a body matching worldResponseSchema', () => {
    return request(app.getHttpServer())
      .patch('/api/worlds/mbti')
      .send({ name: 'MBTI Discussion (updated)' })
      .expect(200)
      .expect((res) => {
        expect(worldResponseSchema.safeParse(res.body).success).toBe(true);
      });
  });

  it('DELETE /api/worlds/mbti returns 204', () => {
    return request(app.getHttpServer()).delete('/api/worlds/mbti').expect(204);
  });

  it('POST /api/worlds without an authenticated session returns 401', () => {
    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = null;

    return request(app.getHttpServer())
      .post('/api/worlds')
      .send({
        name: 'Unauthorized World',
        slug: 'unauthorized-world',
        rules: [],
        topicScope: 'n/a',
      })
      .expect(401)
      .expect((res) => {
        expect(res.body).toEqual({
          statusCode: 401,
          message: 'Unauthorized',
          error: 'UnauthorizedException',
        });
      });
  });

  it('POST /api/worlds with a USER session returns 403', () => {
    const sessionHolder = app.get<MockAuthSessionHolder>(MOCK_AUTH_SESSION);
    sessionHolder.current = {
      user: { role: 'USER' },
      session: { id: 'mock-session' },
    };

    return request(app.getHttpServer())
      .post('/api/worlds')
      .send({
        name: 'Unauthorized World',
        slug: 'unauthorized-world',
        rules: [],
        topicScope: 'n/a',
      })
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
