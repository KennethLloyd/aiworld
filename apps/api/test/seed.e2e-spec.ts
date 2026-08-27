import { PrismaPg } from '@prisma/adapter-pg';

import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { PrismaService } from '@/lib/database/prisma.service';
import { PrismaVoteRepository } from '@/votes/repositories/prisma-vote.repository';
import { PrismaWorldMemberRepository } from '@/world-members/repositories/prisma-world-member.repository';

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
  const commentId = seedUuid('test-comment:constraints');

  beforeAll(async () => {
    await prisma.vote.deleteMany({
      where: { OR: [{ postId }, { commentId }] },
    });
    await prisma.comment.deleteMany({ where: { postId } });
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
    await prisma.comment.create({
      data: {
        id: commentId,
        postId,
        authorMemberId: memberId,
        content: 'A persistence test comment.',
      },
    });
  });

  afterAll(async () => {
    await prisma.vote.deleteMany({
      where: { OR: [{ postId }, { commentId }] },
    });
    await prisma.comment.deleteMany({ where: { postId } });
    await prisma.post.deleteMany({ where: { id: postId } });
    await prisma.worldMember.deleteMany({ where: { id: memberId } });
    await prisma.character.deleteMany({
      where: { id: { in: [characterId, unclassifiedCharacterId] } },
    });
    await prisma.world.deleteMany({ where: { id: worldId } });
    await prisma.$disconnect();
  });

  it('rejects duplicate votes by the same member and post', async () => {
    const firstVoteId = seedUuid('test-vote:member-post');

    await prisma.vote.deleteMany({ where: { id: firstVoteId } });
    await prisma.vote.create({
      data: { id: firstVoteId, authorMemberId: memberId, postId, value: 1 },
    });

    await expect(
      prisma.vote.create({
        data: {
          id: seedUuid('test-vote:duplicate-member-post'),
          authorMemberId: memberId,
          postId,
          value: -1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.vote.deleteMany({ where: { id: firstVoteId } });
  });
  it('changes, repeats, and removes a Post vote with a consistent score', async () => {
    const voteRepository = new PrismaVoteRepository(
      prisma as unknown as PrismaService,
    );

    const created = await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: 1,
    });
    expect(created).toEqual({ id: expect.any(String) });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 1 });

    const repeated = await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: 1,
    });
    expect(repeated).toEqual(created);
    expect(
      await prisma.vote.count({ where: { postId, authorMemberId: memberId } }),
    ).toBe(1);
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 1 });

    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: -1,
    });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: -1 });

    const repeatedDownvote = await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: -1,
    });
    expect(repeatedDownvote).toEqual(created);
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: -1 });

    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: 1,
    });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 1 });

    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: null,
    });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 0 });

    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: -1,
    });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: -1 });
    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: null,
    });
    expect(
      await prisma.vote.findFirst({
        where: { postId, authorMemberId: memberId },
      }),
    ).toBeNull();
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 0 });
  });
  it('keeps inactive-member votes out of the stored Post score', async () => {
    const voteRepository = new PrismaVoteRepository(
      prisma as unknown as PrismaService,
    );
    const memberRepository = new PrismaWorldMemberRepository(
      prisma as unknown as PrismaService,
    );

    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: 1,
    });
    await memberRepository.update(memberId, { isActive: false });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 0 });

    await memberRepository.update(memberId, { isActive: true });
    expect(
      await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
    ).toMatchObject({ voteScore: 1 });
    await voteRepository.setForPost({
      postId,
      authorMemberId: memberId,
      value: null,
    });
  });

  it('rolls back a failed vote mutation', async () => {
    const voteRepository = new PrismaVoteRepository(
      prisma as unknown as PrismaService,
    );
    const maxInt = 2_147_483_647;

    await prisma.post.update({
      where: { id: postId },
      data: { voteScore: maxInt },
    });

    try {
      await expect(
        voteRepository.setForPost({
          postId,
          authorMemberId: memberId,
          value: 1,
        }),
      ).rejects.toThrow();
      expect(
        await prisma.vote.findFirst({
          where: { postId, authorMemberId: memberId },
        }),
      ).toBeNull();
      expect(
        await prisma.post.findUniqueOrThrow({ where: { id: postId } }),
      ).toMatchObject({ voteScore: maxInt });
    } finally {
      await prisma.post.update({
        where: { id: postId },
        data: { voteScore: 0 },
      });
    }
  });

  it('rejects duplicate votes by the same member and comment', async () => {
    const firstVoteId = seedUuid('test-vote:member-comment');

    await prisma.vote.deleteMany({ where: { id: firstVoteId } });
    await prisma.vote.create({
      data: { id: firstVoteId, authorMemberId: memberId, commentId, value: 1 },
    });

    await expect(
      prisma.vote.create({
        data: {
          id: seedUuid('test-vote:duplicate-member-comment'),
          authorMemberId: memberId,
          commentId,
          value: -1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });

    await prisma.vote.deleteMany({ where: { id: firstVoteId } });
  });

  it('allows the same member to vote on different targets', async () => {
    await prisma.vote.create({
      data: {
        id: seedUuid('test-vote:member-post-and-comment'),
        authorMemberId: memberId,
        postId,
        commentId: null,
        value: 1,
      },
    });
    await prisma.vote.create({
      data: {
        id: seedUuid('test-vote:member-comment-only'),
        authorMemberId: memberId,
        postId: null,
        commentId,
        value: -1,
      },
    });

    const votes = await prisma.vote.findMany({
      where: {
        id: {
          in: [
            seedUuid('test-vote:member-post-and-comment'),
            seedUuid('test-vote:member-comment-only'),
          ],
        },
      },
    });

    expect(votes).toHaveLength(2);

    await prisma.vote.deleteMany({
      where: {
        id: {
          in: [
            seedUuid('test-vote:member-post-and-comment'),
            seedUuid('test-vote:member-comment-only'),
          ],
        },
      },
    });
  });

  it('rejects votes whose value is outside -1 and 1', async () => {
    await expect(
      prisma.vote.create({
        data: {
          id: seedUuid('test-vote:invalid-value'),
          authorMemberId: memberId,
          postId,
          value: 2,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2039' });
  });

  it('rejects votes without exactly one target', async () => {
    await expect(
      prisma.vote.create({
        data: {
          id: seedUuid('test-vote:no-target'),
          authorMemberId: memberId,
          value: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2039' });

    await expect(
      prisma.vote.create({
        data: {
          id: seedUuid('test-vote:two-targets'),
          authorMemberId: memberId,
          postId,
          commentId,
          value: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2039' });
  });

  it('removes the vote counter columns from posts and comments', async () => {
    const counterColumns = await prisma.$queryRaw<Array<{ count: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM information_schema.columns
        WHERE table_name IN ('post', 'comment')
          AND column_name IN ('upvotes', 'downvotes')
      `,
    );

    expect(counterColumns[0]?.count).toBe(0);

    const votePrincipalColumns = await prisma.$queryRaw<
      Array<{ count: number }>
    >(
      Prisma.sql`
        SELECT COUNT(*)::int AS count
        FROM information_schema.columns
        WHERE table_name = 'vote'
          AND column_name IN ('userId', 'characterId')
      `,
    );

    expect(votePrincipalColumns[0]?.count).toBe(0);
  });

  it('rewrites the vote constraints to the WorldMember-gated shape', async () => {
    const checks = await prisma.$queryRaw<Array<{ constraint_name: string }>>(
      Prisma.sql`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name IN ('vote', 'post', 'comment')
          AND constraint_type = 'CHECK'
          AND constraint_name IN (
            'vote_one_target_check',
            'vote_value_check',
            'vote_one_voter_check',
            'post_vote_counts_check',
            'comment_vote_counts_check'
          )
        ORDER BY constraint_name
      `,
    );

    expect(checks.map((row) => row.constraint_name)).toEqual([
      'vote_one_target_check',
      'vote_value_check',
    ]);

    const foreignKeys = await prisma.$queryRaw<
      Array<{ constraint_name: string }>
    >(
      Prisma.sql`
        SELECT constraint_name
        FROM information_schema.table_constraints
        WHERE table_name = 'vote'
          AND constraint_type = 'FOREIGN KEY'
        ORDER BY constraint_name
      `,
    );

    expect(foreignKeys.map((row) => row.constraint_name)).toEqual([
      'vote_authorMemberId_fkey',
      'vote_commentId_fkey',
      'vote_postId_fkey',
    ]);

    const uniqueIndexes = await prisma.$queryRaw<Array<{ indexdef: string }>>(
      Prisma.sql`
        SELECT indexdef
        FROM pg_indexes
        WHERE indexname IN (
          'vote_member_post_unique',
          'vote_member_comment_unique'
        )
        ORDER BY indexname
      `,
    );

    expect(uniqueIndexes).toHaveLength(2);
    expect(uniqueIndexes[0]?.indexdef).toContain(
      'ON public.vote USING btree ("authorMemberId", "commentId")',
    );
    expect(uniqueIndexes[0]?.indexdef).toContain(
      'WHERE (("authorMemberId" IS NOT NULL) AND ("commentId" IS NOT NULL))',
    );
    expect(uniqueIndexes[1]?.indexdef).toContain(
      'ON public.vote USING btree ("authorMemberId", "postId")',
    );
    expect(uniqueIndexes[1]?.indexdef).toContain(
      'WHERE (("authorMemberId" IS NOT NULL) AND ("postId" IS NOT NULL))',
    );
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
