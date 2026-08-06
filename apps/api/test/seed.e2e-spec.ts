import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

import { seedUuid } from '../prisma/seed-data';

describe('seed persistence constraints', () => {
  const databaseUrl =
    process.env.DATABASE_URL ??
    'postgres://postgres:postgres@localhost:5432/aiworld';
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });
  const worldId = seedUuid('test-world:constraints');
  const characterId = seedUuid('test-character:constraints');
  const unclassifiedCharacterId = seedUuid('test-character:unclassified');
  const memberId = seedUuid('test-member:constraints');
  const postId = seedUuid('test-post:constraints');

  beforeAll(async () => {
    await prisma.vote.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.worldMember.deleteMany({ where: { id: memberId } });
    await prisma.character.deleteMany({
      where: { id: { in: [characterId, unclassifiedCharacterId] } },
    });
    await prisma.world.deleteMany({ where: { id: worldId } });

    await prisma.world.create({
      data: {
        id: worldId,
        name: 'Constraint Test World',
        slug: 'constraint-test-world',
        description: { about: 'Persistence constraint fixture.' },
        rules: ['Test rules.'],
        topicScope: 'Persistence tests.',
      },
    });
    await prisma.character.create({
      data: {
        id: characterId,
        handle: 'constraint_fixture',
        name: 'Constraint Fixture',
        classification: 'fixture',
        classificationGroup: null,
        avatarUrl: '/avatars/constraint_fixture.svg',
        biography: 'A persistence test character.',
        traits: ['Precise'],
        systemPrompt: 'You are a persistence test character.',
      },
    });
    await prisma.worldMember.create({
      data: {
        id: memberId,
        worldId,
        characterId,
        role: 'AI',
      },
    });
    await prisma.post.create({
      data: {
        id: postId,
        worldId,
        authorMemberId: memberId,
        title: 'Constraint fixture post',
        content: 'A persistence test post.',
      },
    });
  });

  afterAll(async () => {
    await prisma.vote.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.worldMember.deleteMany({ where: { id: memberId } });
    await prisma.character.deleteMany({
      where: { id: { in: [characterId, unclassifiedCharacterId] } },
    });
    await prisma.world.deleteMany({ where: { id: worldId } });
    await prisma.$disconnect();
  });

  it('rejects duplicate votes by the same character and post', async () => {
    const firstVoteId = seedUuid('test-vote:character-post');

    await prisma.vote.deleteMany({ where: { id: firstVoteId } });
    await prisma.vote.create({
      data: { id: firstVoteId, characterId, postId, value: 1 },
    });

    await expect(
      prisma.vote.create({
        data: {
          id: seedUuid('test-vote:duplicate-character-post'),
          characterId,
          postId,
          value: -1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.vote.delete({ where: { id: firstVoteId } });
  });

  it('allows a character without classification metadata or an avatar', async () => {
    const character = await prisma.character.create({
      data: {
        id: unclassifiedCharacterId,
        handle: 'unclassified_fixture',
        name: 'Unclassified Fixture',
        classification: null,
        classificationGroup: null,
        avatarUrl: null,
        biography: 'A character without a classification.',
        traits: ['Generic'],
        systemPrompt: 'You are an unclassified fixture character.',
      },
    });

    expect(character.classification).toBeNull();
    expect(character.classificationGroup).toBeNull();
    expect(character.avatarUrl).toBeNull();
    await prisma.character.delete({ where: { id: unclassifiedCharacterId } });
  });
});
