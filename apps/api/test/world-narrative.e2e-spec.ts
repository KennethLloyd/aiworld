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
  const handle = `@ledger${worldId.replaceAll('-', '')}`;
  const seen: string[][] = [];
  const contextTitles: string[] = [];
  let narrativeCall = 0;
  let failNext = false;

  const provider = {
    generateStructured: jest.fn(
      async (request: { prompt: { user: string } }) => {
        if (failNext) {
          failNext = false;
          throw new Error('narrator unavailable');
        }
        const sources = (
          JSON.parse(request.prompt.user) as {
            sources: Array<{
              id: string;
              kind: string;
              parentPost?: { title: string };
            }>;
          }
        ).sources;
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
        return {
          output: {
            recentEvents: routine
              ? ''
              : hasComment
                ? `${handle} returned to the earlier repair idea.`
                : `${handle} opened the workshop story (${narrativeCall}).`,
            storyContinuation: routine
              ? ''
              : hasComment
                ? `${handle} returned to the earlier repair idea.`
                : `The workshop story grew (${narrativeCall}).`,
            continuitySummary: 'The repair idea remains open.',
          },
        };
      },
    ),
  } as unknown as LlmProvider;
  const service = new WorldNarrativeService(prisma as never, provider);
  let routineCommentId = '';

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
    await prisma.character.create({
      data: {
        id: characterId,
        handle: handle.slice(1),
        name: 'Ledger',
        biography: '',
        traits: {},
        systemPrompt: '',
      },
    });
    await prisma.worldMember.create({
      data: { id: memberId, worldId, characterId, role: 'AI' },
    });
  });

  afterAll(async () => {
    await prisma.world.delete({ where: { id: worldId } });
    await prisma.character.delete({ where: { id: characterId } });
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
    expect((await service.getPublic(worldId)).storySoFar).toContain(
      'The workshop story grew (2).',
    );

    const oldPostId = ids[0]!;
    const comment = await prisma.comment.create({
      data: {
        postId: oldPostId,
        authorMemberId: memberId,
        content: 'The repair idea is still open.',
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
    expect((await service.getPublic(worldId)).storySoFar).toContain(
      `${handle} returned to the earlier repair idea.`,
    );
    expect(contextTitles).toContain('Workshop note 0');
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
    expect(
      await prisma.worldNarrative.findUnique({
        where: { worldId },
        select: { lastCommentId: true },
      }),
    ).toEqual({ lastCommentId: routineComment.id });
    expect(Object.keys(await service.getPublic(worldId)).sort()).toEqual([
      'recentEvents',
      'storySoFar',
    ]);
  });
});
