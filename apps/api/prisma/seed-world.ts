import '../src/lib/config/environment';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';
import { loadProviderConfig } from '@/lib/llm/provider-config';

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

  const simulationDefaults =
    createDefaultSimulationConfig(loadProviderConfig());

  return prisma.$transaction(async (tx) => {
    // Remove the starter world's obsolete slug while leaving generic World CRUD intact.
    await tx.world.deleteMany({ where: { slug: 'mbti' } });

    const world = await tx.world.upsert({
      where: { slug: canonicalWorld.slug },
      create: canonicalWorld,
      update: canonicalWorld,
    });
    const currentCharacterIds = characters.map((character) =>
      seedUuid(`character:${character.key}`),
    );
    const legacyMembers = await tx.worldMember.findMany({
      where: {
        worldId: world.id,
        characterId: { notIn: currentCharacterIds },
      },
      select: { id: true },
    });
    if (legacyMembers.length > 0) {
      const legacyMemberIds = legacyMembers.map((member) => member.id);
      await tx.vote.deleteMany({
        where: { authorMemberId: { in: legacyMemberIds } },
      });
      await tx.comment.deleteMany({
        where: { authorMemberId: { in: legacyMemberIds } },
      });
      await tx.post.deleteMany({
        where: { authorMemberId: { in: legacyMemberIds } },
      });
      await tx.worldMember.deleteMany({
        where: { id: { in: legacyMemberIds } },
      });
    }

    const memberIds = new Map<string, string>();

    for (const character of characters) {
      const characterId = seedUuid(`character:${character.key}`);

      await tx.character.upsert({
        where: { id: characterId },
        create: {
          id: characterId,
          handle: character.handle,
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
          handle: character.handle,
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
    const memberKeyList = characters.map((character) => character.key);
    const postVoteSets = posts.map((post) => ({
      post,
      votes: buildSeedVotes(post, memberKeyList),
    }));

    for (const { post, votes } of postVoteSets) {
      const voteScore = votes.reduce((score, vote) => score + vote.value, 0);

      await tx.post.upsert({
        where: { id: seedUuid(`post:${post.key}`) },
        create: {
          id: seedUuid(`post:${post.key}`),
          worldId: world.id,
          authorMemberId: memberIdFor(post.authorKey),
          title: post.title,
          content: post.content,
          voteScore,
          createdAt: new Date(post.createdAt),
        },
        update: {
          worldId: world.id,
          authorMemberId: memberIdFor(post.authorKey),
          title: post.title,
          content: post.content,
          voteScore,
          createdAt: new Date(post.createdAt),
        },
      });

      for (const comment of flattenComments(post.comments)) {
        const voteScore = buildSeedVotes(comment, memberKeyList).reduce(
          (score, vote) => score + vote.value,
          0,
        );
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
            voteScore,
            createdAt: new Date(comment.createdAt),
          },
          update: {
            postId: seedUuid(`post:${post.key}`),
            authorMemberId: memberIdFor(comment.authorKey),
            parentCommentId: comment.parentKey
              ? seedUuid(`comment:${comment.parentKey}`)
              : null,
            content: comment.content,
            voteScore,
            createdAt: new Date(comment.createdAt),
          },
        });
      }
    }

    const voteRows = postVoteSets.flatMap(({ post, votes }) => [
      ...votes.map((vote) => ({
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
        ...simulationDefaults,
      },
      update: simulationDefaults,
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
