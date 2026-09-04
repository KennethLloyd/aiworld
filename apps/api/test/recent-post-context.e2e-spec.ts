import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import { App } from 'supertest/types';

import { AppModule } from '@/app.module';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { PostRepository } from '@/posts/repositories/post-repository.interface';

import { seedUuid } from '../prisma/seed-data';

const databaseUrl =
  process.env.DATABASE_URL ??
  'postgres://postgres:postgres@localhost:5432/aiworld';

const fixture = {
  worldId: seedUuid('world:recent-post-context'),
  worldSlug: 'recent-post-context-fixture',
  characterId: seedUuid('character:recent-post-context'),
  memberId: seedUuid('member:recent-post-context'),
  inactiveCharacterId: seedUuid('character:recent-post-context-inactive'),
  inactiveMemberId: seedUuid('member:recent-post-context-inactive'),
  otherWorldId: seedUuid('world:recent-post-context-other'),
  otherWorldMemberId: seedUuid('member:recent-post-context-other'),
  otherWorldCharacterId: seedUuid('character:recent-post-context-other'),
};

async function deleteFixture(prisma: PrismaClient): Promise<void> {
  for (const slug of [fixture.worldSlug, 'recent-post-context-other']) {
    await prisma.vote.deleteMany({
      where: { post: { world: { slug } } },
    });
    await prisma.vote.deleteMany({
      where: { comment: { post: { world: { slug } } } },
    });
    await prisma.world.deleteMany({ where: { slug } });
  }
  await prisma.character.deleteMany({
    where: {
      id: {
        in: [
          fixture.characterId,
          fixture.inactiveCharacterId,
          fixture.otherWorldCharacterId,
        ],
      },
    },
  });
}

describe('Recent POST context (real database)', () => {
  let app: INestApplication<App>;
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  beforeAll(async () => {
    await deleteFixture(prisma);

    await prisma.world.create({
      data: {
        id: fixture.worldId,
        name: 'Recent Post Context Fixture',
        slug: fixture.worldSlug,
        description: {},
        rules: [],
        topicScope: 'Testing recent POST context.',
      },
    });
    await prisma.world.create({
      data: {
        id: fixture.otherWorldId,
        name: 'Other Recent Post Context Fixture',
        slug: 'recent-post-context-other',
        description: {},
        rules: [],
        topicScope: 'Testing World isolation.',
      },
    });
    await prisma.character.createMany({
      data: [
        {
          id: fixture.characterId,
          handle: 'recent_author',
          name: 'Recent Author',
          biography: 'Fixture author.',
          traits: [],
          systemPrompt: 'Fixture.',
          isActive: true,
        },
        {
          id: fixture.inactiveCharacterId,
          handle: 'historical_author',
          name: 'Historical Author',
          biography: 'Fixture historical author.',
          traits: [],
          systemPrompt: 'Fixture.',
          isActive: false,
        },
        {
          id: fixture.otherWorldCharacterId,
          handle: 'other_world_author',
          name: 'Other World Author',
          biography: 'Fixture author in another World.',
          traits: [],
          systemPrompt: 'Fixture.',
          isActive: true,
        },
      ],
    });
    await prisma.worldMember.createMany({
      data: [
        {
          id: fixture.memberId,
          worldId: fixture.worldId,
          characterId: fixture.characterId,
          role: 'AI',
          isActive: true,
        },
        {
          id: fixture.inactiveMemberId,
          worldId: fixture.worldId,
          characterId: fixture.inactiveCharacterId,
          role: 'AI',
          isActive: false,
        },
        {
          id: fixture.otherWorldMemberId,
          worldId: fixture.otherWorldId,
          characterId: fixture.otherWorldCharacterId,
          role: 'AI',
          isActive: true,
        },
      ],
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await deleteFixture(prisma);
    await app.get(PrismaService).$disconnect();
    await app.close();
    await prisma.$disconnect();
  });

  it('returns five newest same-World posts with deterministic ordering and author identity', async () => {
    const equalTimestamp = new Date('2026-01-04T00:00:00.000Z');
    const equalIds = [
      seedUuid('post:recent-post-context-equal-a'),
      seedUuid('post:recent-post-context-equal-b'),
    ].sort();
    const postRows = [
      {
        id: seedUuid('post:recent-post-context-old'),
        worldId: fixture.worldId,
        authorMemberId: fixture.memberId,
        title: 'Old post',
        content: 'Old content.',
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
      {
        id: equalIds[0]!,
        worldId: fixture.worldId,
        authorMemberId: fixture.inactiveMemberId,
        title: 'Historical post',
        content: 'Written before this author became inactive.',
        createdAt: equalTimestamp,
      },
      {
        id: equalIds[1]!,
        worldId: fixture.worldId,
        authorMemberId: fixture.memberId,
        title: 'Equal timestamp post',
        content: 'A deterministic tie breaker matters.',
        createdAt: equalTimestamp,
      },
      {
        id: seedUuid('post:recent-post-context-middle'),
        worldId: fixture.worldId,
        authorMemberId: fixture.memberId,
        title: 'Middle post',
        content: 'Middle content.',
        createdAt: new Date('2026-01-03T00:00:00.000Z'),
      },
      {
        id: seedUuid('post:recent-post-context-new'),
        worldId: fixture.worldId,
        authorMemberId: fixture.memberId,
        title: 'New post',
        content: 'New content.',
        createdAt: new Date('2026-01-05T00:00:00.000Z'),
      },
      {
        id: seedUuid('post:recent-post-context-newest'),
        worldId: fixture.worldId,
        authorMemberId: fixture.memberId,
        title: 'Newest post',
        content: 'Newest content.',
        createdAt: new Date('2026-01-06T00:00:00.000Z'),
      },
      {
        id: seedUuid('post:recent-post-context-other-world'),
        worldId: fixture.otherWorldId,
        authorMemberId: fixture.otherWorldMemberId,
        title: 'Other World post',
        content: 'This must stay isolated.',
        createdAt: new Date('2026-01-07T00:00:00.000Z'),
      },
    ];
    await prisma.post.createMany({ data: postRows });

    try {
      const posts = await app
        .get(PostRepository)
        .findRecentByWorld(fixture.worldId, 5);

      expect(posts.map((post) => post.id)).toEqual([
        seedUuid('post:recent-post-context-newest'),
        seedUuid('post:recent-post-context-new'),
        equalIds[0],
        equalIds[1],
        seedUuid('post:recent-post-context-middle'),
      ]);
      expect(posts.map((post) => post.author.handle)).toContain(
        'historical_author',
      );
      expect(
        posts.find((post) => post.author.handle === 'historical_author'),
      ).toMatchObject({
        title: 'Historical post',
        author: {
          handle: 'historical_author',
          name: 'Historical Author',
        },
      });
      expect(posts.map((post) => post.title)).not.toContain('Other World post');
    } finally {
      await prisma.post.deleteMany({
        where: { id: { in: postRows.map((post) => post.id) } },
      });
    }
  });
});
