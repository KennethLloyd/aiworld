import '../src/lib/config/environment';
import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';

import {
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seededNarrative,
  seededVoteRows,
  seedUuid,
  validateCommentDepth,
} from './seed-data';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

function atOffset(anchor: Date, offsetMinutes: number): Date {
  return new Date(anchor.getTime() + offsetMinutes * 60_000);
}

function voteScore(votes: Array<{ value: 1 | -1 }>): number {
  return votes.reduce((score, entry) => score + entry.value, 0);
}

export async function seedWorld(prisma: PrismaClient) {
  const anchor = new Date();

  for (const post of posts) {
    validateCommentDepth(post.comments);
  }

  return prisma.$transaction(async (tx) => {
    const existingWorld = await tx.world.findUnique({
      where: { slug: canonicalWorld.slug },
      select: { id: true },
    });
    const world = existingWorld
      ? await tx.world.update({
          where: { id: existingWorld.id },
          data: canonicalWorld,
        })
      : await tx.world.create({
          data: { id: seedUuid('world:stillwater'), ...canonicalWorld },
        });

    const existingPosts = await tx.post.findMany({
      where: { worldId: world.id },
      select: { id: true },
    });
    const existingComments = await tx.comment.findMany({
      where: { post: { worldId: world.id } },
      select: { id: true },
    });
    const existingMemberIds = await tx.worldMember.findMany({
      where: { worldId: world.id },
      select: { id: true },
    });

    if (existingPosts.length > 0 || existingComments.length > 0) {
      await tx.vote.deleteMany({
        where: {
          OR: [
            { postId: { in: existingPosts.map((post) => post.id) } },
            {
              commentId: { in: existingComments.map((comment) => comment.id) },
            },
          ],
        },
      });
      await tx.comment.deleteMany({
        where: { id: { in: existingComments.map((comment) => comment.id) } },
      });
      await tx.post.deleteMany({
        where: { id: { in: existingPosts.map((post) => post.id) } },
      });
    }
    if (existingMemberIds.length > 0) {
      await tx.vote.deleteMany({
        where: {
          authorMemberId: { in: existingMemberIds.map((member) => member.id) },
        },
      });
    }
    await tx.simulationLog.deleteMany({ where: { worldId: world.id } });
    await tx.worldNarrative.deleteMany({ where: { worldId: world.id } });
    await tx.simulationRuntimeState.deleteMany({
      where: { worldId: world.id },
    });
    await tx.worldMember.deleteMany({ where: { worldId: world.id } });

    const memberIds = new Map<string, string>();
    for (const [index, character] of characters.entries()) {
      const existingCharacter = await tx.character.findUnique({
        where: { handle: character.handle },
        select: { id: true },
      });
      const persisted = existingCharacter
        ? await tx.character.update({
            where: { id: existingCharacter.id },
            data: {
              name: character.name,
              classification: character.classification,
              classificationGroup: character.classificationGroup,
              gender: character.gender,
              pronouns: character.pronouns,
              avatarUrl: character.avatarUrl,
              biography: character.biography,
              traits: character.traits,
              systemPrompt: character.systemPrompt,
              isActive: character.isActive,
            },
          })
        : await tx.character.create({
            data: {
              id: seedUuid(`character:${character.key}`),
              handle: character.handle,
              name: character.name,
              classification: character.classification,
              classificationGroup: character.classificationGroup,
              gender: character.gender,
              pronouns: character.pronouns,
              avatarUrl: character.avatarUrl,
              biography: character.biography,
              traits: character.traits,
              systemPrompt: character.systemPrompt,
              isActive: character.isActive,
            },
          });
      const member = await tx.worldMember.create({
        data: {
          id: seedUuid(`member:${character.key}`),
          worldId: world.id,
          characterId: persisted.id,
          role: 'AI',
          isActive: true,
          joinedAt: atOffset(anchor, -characters.length + index),
          narrativeMemory:
            seededNarrative.characterNarratives[
              character.key as keyof typeof seededNarrative.characterNarratives
            ],
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
    const voteRows = seededVoteRows();
    for (const row of voteRows) {
      const targetAuthorKey = row.postKey
        ? posts.find((post) => post.key === row.postKey)?.authorKey
        : posts
            .flatMap((post) => flattenComments(post.comments))
            .find((comment) => comment.key === row.commentKey)?.authorKey;
      if (targetAuthorKey === row.memberKey) {
        throw new Error(`Seeded self-vote is not allowed: ${row.key}`);
      }
    }

    for (const post of posts) {
      const postVotes = post.votes;
      await tx.post.create({
        data: {
          id: seedUuid(`post:${post.key}`),
          worldId: world.id,
          authorMemberId: memberIdFor(post.authorKey),
          title: post.title,
          content: post.content,
          voteScore: voteScore(postVotes),
          createdAt: atOffset(anchor, post.offsetMinutes),
        },
      });
      for (const comment of flattenComments(post.comments)) {
        const commentVotes = comment.votes;
        await tx.comment.create({
          data: {
            id: seedUuid(`comment:${comment.key}`),
            postId: seedUuid(`post:${post.key}`),
            authorMemberId: memberIdFor(comment.authorKey),
            parentCommentId: comment.parentKey
              ? seedUuid(`comment:${comment.parentKey}`)
              : null,
            content: comment.content,
            voteScore: voteScore(commentVotes),
            createdAt: atOffset(anchor, comment.offsetMinutes),
          },
        });
      }
    }

    await tx.vote.createMany({
      data: voteRows.map((row) => ({
        id: seedUuid(`vote:${row.key}`),
        postId: row.postKey ? seedUuid(`post:${row.postKey}`) : null,
        commentId: row.commentKey
          ? seedUuid(`comment:${row.commentKey}`)
          : null,
        authorMemberId: memberIdFor(row.memberKey),
        value: row.value,
      })),
    });

    const newestPost = posts.at(-1);
    const newestComment = posts
      .flatMap((post) => flattenComments(post.comments))
      .at(-1);
    if (!newestPost || !newestComment) {
      throw new Error('Canonical seed requires at least one Post and Comment.');
    }
    await tx.worldNarrative.create({
      data: {
        worldId: world.id,
        recentEvents: seededNarrative.recentEvents,
        storySoFar: seededNarrative.storySoFar,
        continuitySummary: seededNarrative.continuitySummary,
        lastPostAt: atOffset(anchor, newestPost.offsetMinutes),
        lastPostId: seedUuid(`post:${newestPost.key}`),
        lastCommentAt: atOffset(anchor, newestComment.offsetMinutes),
        lastCommentId: seedUuid(`comment:${newestComment.key}`),
      },
    });

    await tx.worldSimulationConfig.upsert({
      where: { worldId: world.id },
      create: {
        id: seedUuid('simulation-config:stillwater'),
        worldId: world.id,
        ...createDefaultSimulationConfig(),
      },
      update: createDefaultSimulationConfig(),
    });

    return world;
  });
}

async function main() {
  const prisma = new PrismaClient({ adapter });
  try {
    const world = await seedWorld(prisma);
    console.log(
      `Seeded ${world.name} (${world.slug}) at ${new Date().toISOString()}.`,
    );
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
