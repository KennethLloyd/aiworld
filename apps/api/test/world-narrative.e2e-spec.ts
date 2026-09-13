import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import request from 'supertest';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';

import { seedWorld } from '../prisma/seed-world';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/aiworld';

describe('World narrative (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  beforeAll(async () => {
    await seedWorld(prisma);
    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: 'mbti-house' },
      select: { id: true },
    });
    await prisma.worldNarrative.upsert({
      where: { worldId: world.id },
      create: {
        worldId: world.id,
        recentEvents: '@readthemanual found a clue.',
        storySoFar: '@readthemanual noticed the clue.',
        continuitySummary: 'Private detail must stay private.',
      },
      update: {
        recentEvents: '@readthemanual found a clue.',
        storySoFar: '@readthemanual noticed the clue.',
        continuitySummary: 'Private detail must stay private.',
      },
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await prisma.worldNarrative.deleteMany({
      where: { world: { slug: 'mbti-house' } },
    });
    await app.get(PrismaService).$disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  it('returns saved public prose while keeping continuity private', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/worlds/mbti-house/narrative')
      .expect(200);

    expect(response.body).toEqual({
      recentEvents: '@readthemanual found a clue.',
      storySoFar: '@readthemanual noticed the clue.',
    });
    expect(JSON.stringify(response.body)).not.toContain('Private detail');
  });

  it('returns null public fields before narration completes', async () => {
    const world = await prisma.world.create({
      data: {
        name: 'Empty Narrative Fixture',
        slug: 'empty-narrative-fixture',
        description: {},
        rules: [],
        topicScope: 'Narrative endpoint coverage.',
      },
    });
    try {
      const response = await request(app.getHttpServer())
        .get('/api/worlds/empty-narrative-fixture/narrative')
        .expect(200);
      expect(response.body).toEqual({ recentEvents: null, storySoFar: null });
    } finally {
      await prisma.world.delete({ where: { id: world.id } });
    }
  });
});
