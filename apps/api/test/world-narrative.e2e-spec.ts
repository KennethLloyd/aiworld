import { randomUUID } from 'node:crypto';

import { PrismaPg } from '@prisma/adapter-pg';

import { PrismaClient } from '@/generated/prisma/client';
import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';

const prisma = new PrismaClient({
  adapter: new PrismaPg({
    connectionString:
      process.env.DATABASE_URL ??
      'postgres://postgres:postgres@localhost:5432/aiworld',
  }),
});

describe('World narrative persistence', () => {
  const worldId = randomUUID();
  const characterId = randomUUID();
  const memberId = randomUUID();
  const replyingCharacterId = randomUUID();
  const replyingMemberId = randomUUID();
  const unrelatedCharacterId = randomUUID();
  const unrelatedMemberId = randomUUID();
  const handle = `@ledger${worldId.replaceAll('-', '')}`;
  const replyingHandle = `@planner${worldId.replaceAll('-', '')}`;
  const unrelatedHandle = `@gardener${worldId.replaceAll('-', '')}`;
  const seen: string[][] = [];
  const contextTitles: string[] = [];
  const existingStories: Array<string | null> = [];
  const existingCharacterMemories: string[][] = [];
  let narrativeCall = 0;
  let failNext = false;
  let routineCommentId = '';
  let unrelatedPostId = '';

  const provider = {
    generateStructured: jest.fn(
      async (request: { prompt: { user: string } }) => {
        if (failNext) {
          failNext = false;
          throw new Error('narrator unavailable');
        }
        const requestContext = JSON.parse(request.prompt.user) as {
          existingStorySoFar: string | null;
          residents: Array<{
            memberId: string;
            existingNarrativeMemory: string;
          }>;
          sources: Array<{
            id: string;
            kind: string;
            parentPost?: { title: string };
          }>;
        };
        const sources = requestContext.sources;
        existingStories.push(requestContext.existingStorySoFar);
        existingCharacterMemories.push(
          requestContext.residents.map(
            (resident) => resident.existingNarrativeMemory,
          ),
        );
        seen.push(sources.map((source) => source.id));
        contextTitles.push(
          ...sources.flatMap((source) =>
            source.parentPost ? [source.parentPost.title] : [],
          ),
        );
        narrativeCall += 1;
        const hasComment = sources.some((source) => source.kind === 'comment');
        const routine = sources.every(
          (source) =>
            source.kind === 'comment' && source.id === routineCommentId,
        );
        const unrelated = sources.every(
          (source) => source.kind === 'post' && source.id === unrelatedPostId,
        );
        return {
          output: {
            recentEvents: routine
              ? ''
              : hasComment
                ? `${handle} returned to the earlier repair idea.`
                : `${handle} opened the workshop story (${narrativeCall}).`,
            storySoFar: routine
              ? ''
              : hasComment
                ? `${handle} consolidated the workshop story around the repair idea.`
                : `The workshop story was consolidated (${narrativeCall}).`,
            continuitySummary: 'The repair idea remains open.',
            characterNarratives: routine
              ? []
              : unrelated
                ? [
                    {
                      memberId: unrelatedMemberId,
                      narrativeMemory: `${unrelatedHandle} is focused on the community garden.`,
                    },
                  ]
                : hasComment
                  ? [
                      {
                        memberId,
                        narrativeMemory: `${handle} is waiting for ${replyingHandle} to confirm the repair plan.`,
                      },
                      {
                        memberId: replyingMemberId,
                        narrativeMemory: `${replyingHandle} offered to confirm ${handle}'s repair plan.`,
                      },
                    ]
                  : [
                      {
                        memberId,
                        narrativeMemory: `${handle} consolidated the workshop plan (${narrativeCall}).`,
                      },
                    ],
          },
        };
      },
    ),
  } as unknown as LlmProvider;
  const service = new WorldNarrativeService(prisma as never, provider);

  beforeAll(async () => {
    await prisma.world.create({
      data: {
        id: worldId,
        slug: `narrative-${worldId}`,
        name: 'Workshop',
        rules: [],
        topicScope: 'Town workshop',
      },
    });
    await prisma.character.createMany({
      data: [
        {
          id: characterId,
          handle: handle.slice(1),
          name: 'Ledger',
          biography: '',
          traits: {},
          systemPrompt: '',
        },
        {
          id: replyingCharacterId,
          handle: replyingHandle.slice(1),
          name: 'Planner',
          biography: '',
          traits: {},
          systemPrompt: '',
        },
        {
          id: unrelatedCharacterId,
          handle: unrelatedHandle.slice(1),
          name: 'Gardener',
          biography: '',
          traits: {},
          systemPrompt: '',
        },
      ],
    });
    await prisma.worldMember.createMany({
      data: [
        { id: memberId, worldId, characterId, role: 'AI' },
        {
          id: replyingMemberId,
          worldId,
          characterId: replyingCharacterId,
          role: 'AI',
        },
        {
          id: unrelatedMemberId,
          worldId,
          characterId: unrelatedCharacterId,
          role: 'AI',
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.world.delete({ where: { id: worldId } });
    await prisma.character.deleteMany({
      where: {
        id: {
          in: [characterId, replyingCharacterId, unrelatedCharacterId],
        },
      },
    });
    await prisma.$disconnect();
  });

  it('processes existing history in batches, then new and older-post activity without duplicates or lost prose on failure', async () => {
    expect(await service.getPublic(worldId)).toEqual({
      recentEvents: null,
      storySoFar: null,
    });
    const ids = Array.from({ length: 45 }, () => randomUUID());
    await prisma.post.createMany({
      data: ids.map((id, index) => ({
        id,
        worldId,
        authorMemberId: memberId,
        title: `Workshop note ${index}`,
        content: `Note ${index}`,
        createdAt: new Date(Date.UTC(2026, 0, 1, 0, index)),
      })),
    });

    await service.process(worldId);
    expect(seen.map((batch) => batch.length)).toEqual([40, 5]);
    expect(new Set(seen.flat()).size).toBe(45);
    expect(await service.getPublic(worldId)).toMatchObject({
      storySoFar: 'The workshop story was consolidated (2).',
    });
    expect(existingStories).toEqual([
      null,
      'The workshop story was consolidated (1).',
    ]);
    expect(
      await prisma.worldMember.findUnique({
        where: { id: memberId },
        select: { narrativeMemory: true },
      }),
    ).toEqual({
      narrativeMemory: `${handle} consolidated the workshop plan (2).`,
    });
    expect(existingCharacterMemories[1]).toContain(
      `${handle} consolidated the workshop plan (1).`,
    );

    const oldPostId = ids[0]!;
    const comment = await prisma.comment.create({
      data: {
        postId: oldPostId,
        authorMemberId: replyingMemberId,
        content: `${handle}, I will confirm the repair plan tomorrow.`,
        createdAt: new Date('2026-01-02T00:00:00Z'),
      },
    });
    failNext = true;
    await expect(service.process(worldId)).rejects.toThrow(
      'narrator unavailable',
    );
    expect((await service.getPublic(worldId)).storySoFar).not.toContain(
      'returned to the earlier',
    );
    await service.process(worldId);
    expect(seen.at(-1)).toEqual([comment.id]);
    expect(await service.getPublic(worldId)).toMatchObject({
      storySoFar: `${handle} consolidated the workshop story around the repair idea.`,
    });
    expect((await service.getPublic(worldId)).storySoFar).not.toContain(
      'The workshop story was consolidated (2).',
    );
    expect(existingStories.at(-1)).toBe(
      'The workshop story was consolidated (2).',
    );
    expect(contextTitles).toContain('Workshop note 0');
    expect(
      await prisma.worldMember.findMany({
        where: { id: { in: [memberId, replyingMemberId] } },
        select: { id: true, narrativeMemory: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(
      [
        {
          id: memberId,
          narrativeMemory: `${handle} is waiting for ${replyingHandle} to confirm the repair plan.`,
        },
        {
          id: replyingMemberId,
          narrativeMemory: `${replyingHandle} offered to confirm ${handle}'s repair plan.`,
        },
      ].sort((a, b) => a.id.localeCompare(b.id)),
    );
    expect(
      await prisma.worldNarrative.findUnique({
        where: { worldId },
        select: { lastCommentId: true },
      }),
    ).toEqual({ lastCommentId: comment.id });
    await service.process(worldId);
    expect(seen.flat().length).toBe(46);
    const beforeRoutine = await service.getPublic(worldId);
    const routineComment = await prisma.comment.create({
      data: {
        postId: oldPostId,
        authorMemberId: memberId,
        content: 'Thanks.',
        createdAt: new Date('2026-01-03T00:00:00Z'),
      },
    });
    routineCommentId = routineComment.id;
    await service.process(worldId);
    expect(await service.getPublic(worldId)).toEqual(beforeRoutine);
    const memoriesAfterRoutine = await prisma.worldMember.findMany({
      where: { id: { in: [memberId, replyingMemberId] } },
      select: { id: true, narrativeMemory: true },
      orderBy: { id: 'asc' },
    });
    expect(
      await prisma.worldNarrative.findUnique({
        where: { worldId },
        select: { lastCommentId: true },
      }),
    ).toEqual({ lastCommentId: routineComment.id });

    const unrelatedPost = await prisma.post.create({
      data: {
        worldId,
        authorMemberId: unrelatedMemberId,
        title: 'Community garden watering',
        content: 'The seedlings need water before sunset.',
        createdAt: new Date('2026-01-04T00:00:00Z'),
      },
    });
    unrelatedPostId = unrelatedPost.id;
    await service.process(worldId);
    expect(
      await prisma.worldMember.findMany({
        where: { id: { in: [memberId, replyingMemberId] } },
        select: { id: true, narrativeMemory: true },
        orderBy: { id: 'asc' },
      }),
    ).toEqual(memoriesAfterRoutine);
    expect(
      await prisma.worldMember.findUnique({
        where: { id: unrelatedMemberId },
        select: { narrativeMemory: true },
      }),
    ).toEqual({
      narrativeMemory: `${unrelatedHandle} is focused on the community garden.`,
    });
    expect(Object.keys(await service.getPublic(worldId)).sort()).toEqual([
      'recentEvents',
      'storySoFar',
    ]);
  });
});
