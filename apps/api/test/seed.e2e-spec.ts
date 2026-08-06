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

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rejects duplicate votes by the same character and post', async () => {
    const characterId = seedUuid('character:standard_procedure');
    const postId = seedUuid('post:p1');
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

  it('allows a character without classification metadata', async () => {
    const world = await prisma.world.findUniqueOrThrow({
      where: { slug: 'mbti-house' },
    });
    const characterId = seedUuid('test-character:non-mbti');

    await prisma.character.deleteMany({ where: { id: characterId } });
    const character = await prisma.character.create({
      data: {
        id: characterId,
        worldId: world.id,
        handle: 'hermione_granger',
        name: 'Hermione Granger',
        classification: null,
        classificationGroup: null,
        avatarSeed: 'HermioneGranger',
        biography: 'A diligent witch and researcher.',
        traits: ['Diligent', 'Brave', 'Curious'],
        systemPrompt: 'You are Hermione Granger. Stay in character.',
      },
    });

    expect(character.classification).toBeNull();
    expect(character.classificationGroup).toBeNull();
    await prisma.character.delete({ where: { id: characterId } });
  });
});
