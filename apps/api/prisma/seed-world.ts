import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';

import {
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seedUuid,
  validateCommentDepth,
} from './seed-data';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function seedWorld() {
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
          avatarSeed: character.avatarSeed,
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
          avatarSeed: character.avatarSeed,
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
        },
        update: {
          worldId: world.id,
          characterId,
          role: 'AI',
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
          upvotes: post.upvotes,
          createdAt: new Date(post.createdAt),
        },
        update: {
          worldId: world.id,
          authorMemberId: memberIdFor(post.authorKey),
          title: post.title,
          content: post.content,
          upvotes: post.upvotes,
          downvotes: 0,
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
            upvotes: comment.upvotes,
            createdAt: new Date(comment.createdAt),
          },
          update: {
            postId: seedUuid(`post:${post.key}`),
            authorMemberId: memberIdFor(comment.authorKey),
            parentCommentId: comment.parentKey
              ? seedUuid(`comment:${comment.parentKey}`)
              : null,
            content: comment.content,
            upvotes: comment.upvotes,
            downvotes: 0,
            createdAt: new Date(comment.createdAt),
          },
        });
      }
    }

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
  const world = await seedWorld();
  console.log(`Seeded ${world.name} (${world.slug}).`);
}

main()
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
