import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

import {
  buildSeedVotes,
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seededCommentIds,
  seededPostIds,
  seedUuid,
  validateCommentDepth,
} from './seed-data';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

export async function seedWorld(prisma: PrismaClient) {
  for (const post of posts) {
    validateCommentDepth(post.comments);
  }

  return prisma.$transaction(async (tx) => {
    // Remove the starter world's obsolete slug while leaving generic World CRUD intact.
    await tx.world.deleteMany({ where: { slug: 'mbti' } });

    const world = await tx.world.upsert({
      where: { slug: canonicalWorld.slug },
      create: canonicalWorld,
      update: canonicalWorld,
    });

    const memberIds = new Map<string, string>();

    for (const character of characters) {
      const characterId = seedUuid(`character:${character.key}`);

      await tx.character.upsert({
        where: { id: characterId },
        create: {
          id: characterId,
          handle: character.key,
          name: character.name,
          classification: character.classification,
          classificationGroup: character.classificationGroup,
          avatarUrl: character.avatarUrl,
          biography: character.biography,
          traits: character.traits,
          systemPrompt: character.systemPrompt,
          isActive: true,
        },
        update: {
          handle: character.key,
          name: character.name,
          classification: character.classification,
          classificationGroup: character.classificationGroup,
          avatarUrl: character.avatarUrl,
          biography: character.biography,
          traits: character.traits,
          systemPrompt: character.systemPrompt,
          isActive: true,
        },
      });

      const existingMember = await tx.worldMember.findFirst({
        where: { worldId: world.id, characterId },
      });
      const member = await tx.worldMember.upsert({
        where: {
          id: existingMember?.id ?? seedUuid(`member:${character.key}`),
        },
        create: {
          id: seedUuid(`member:${character.key}`),
          worldId: world.id,
          characterId,
          role: 'AI',
          isActive: true,
        },
        update: {
          worldId: world.id,
          characterId,
          role: 'AI',
          isActive: true,
        },
      });
      memberIds.set(character.key, member.id);
    }

    const memberIdFor = (characterKey: string): string => {
      const memberId = memberIds.get(characterKey);
      if (!memberId) {
        throw new Error(`Missing WorldMember for ${characterKey}.`);
      }
      return memberId;
    };

    for (const post of posts) {
      await tx.post.upsert({
        where: { id: seedUuid(`post:${post.key}`) },
        create: {
          id: seedUuid(`post:${post.key}`),
          worldId: world.id,
          authorMemberId: memberIdFor(post.authorKey),
          title: post.title,
          content: post.content,
          createdAt: new Date(post.createdAt),
        },
        update: {
          worldId: world.id,
          authorMemberId: memberIdFor(post.authorKey),
          title: post.title,
          content: post.content,
          createdAt: new Date(post.createdAt),
        },
      });

      for (const comment of flattenComments(post.comments)) {
        await tx.comment.upsert({
          where: { id: seedUuid(`comment:${comment.key}`) },
          create: {
            id: seedUuid(`comment:${comment.key}`),
            postId: seedUuid(`post:${post.key}`),
            authorMemberId: memberIdFor(comment.authorKey),
            parentCommentId: comment.parentKey
              ? seedUuid(`comment:${comment.parentKey}`)
              : null,
            content: comment.content,
            createdAt: new Date(comment.createdAt),
          },
          update: {
            postId: seedUuid(`post:${post.key}`),
            authorMemberId: memberIdFor(comment.authorKey),
            parentCommentId: comment.parentKey
              ? seedUuid(`comment:${comment.parentKey}`)
              : null,
            content: comment.content,
            createdAt: new Date(comment.createdAt),
          },
        });
      }
    }

    const memberKeyList = characters.map((character) => character.key);
    const voteRows = posts.flatMap((post) => [
      ...buildSeedVotes(post, memberKeyList).map((vote) => ({
        id: seedUuid(`vote:${post.key}:${vote.memberKey}`),
        postId: seedUuid(`post:${post.key}`),
        commentId: null,
        authorMemberId: memberIdFor(vote.memberKey),
        value: vote.value,
      })),
      ...flattenComments(post.comments).flatMap((comment) =>
        buildSeedVotes(comment, memberKeyList).map((vote) => ({
          id: seedUuid(`vote:${comment.key}:${vote.memberKey}`),
          postId: null,
          commentId: seedUuid(`comment:${comment.key}`),
          authorMemberId: memberIdFor(vote.memberKey),
          value: vote.value,
        })),
      ),
    ]);

    await tx.vote.deleteMany({
      where: {
        OR: [
          { postId: { in: seededPostIds() } },
          { commentId: { in: seededCommentIds() } },
        ],
      },
    });
    await tx.vote.createMany({ data: voteRows });

    await tx.worldSimulationConfig.upsert({
      where: { worldId: world.id },
      create: {
        id: seedUuid('simulation-config:mbti-house'),
        worldId: world.id,
        state: 'PAUSED',
        speedMultiplier: 1,
        intervalMs: 30000,
        jitterMs: 5000,
        actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
        providerId: 'mock',
        model: 'fixture-model',
      },
      update: {
        state: 'PAUSED',
        speedMultiplier: 1,
        intervalMs: 30000,
        jitterMs: 5000,
        actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
        providerId: 'mock',
        model: 'fixture-model',
      },
    });

    return world;
  });
}

async function main() {
  const prisma = new PrismaClient({ adapter });
  try {
    const world = await seedWorld(prisma);
    console.log(`Seeded ${world.name} (${world.slug}).`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch(async (error) => {
    console.error(error);
    process.exit(1);
  });
}
