import type { WorldView } from '@/world/world.service';

import { LlmProvider } from '../providers/llm-provider.port';
import {
  NARRATIVE_BATCH_SIZE,
  WorldNarrativeService,
} from './world-narrative.service';

const world: WorldView = {
  id: 'world-1',
  name: 'Stillwater',
  slug: 'stillwater',
  description: null,
  rules: [],
  topicScope: 'A small town finding its feet.',
  residentCount: 2,
  isActive: true,
  createdAt: new Date('2026-08-01T00:00:00.000Z'),
  updatedAt: new Date('2026-08-01T00:00:00.000Z'),
};

const author = (id: string, handle: string) => ({
  id,
  character: {
    id: `${id}-character`,
    handle,
    name: handle,
    avatarUrl: null,
    classification: null,
    classificationGroup: null,
  },
  user: null,
});

const post = (
  id: string,
  createdAt: string,
  content = 'A town observation.',
) => ({
  id,
  title: `Post ${id}`,
  content,
  createdAt: new Date(createdAt),
  author: author(`member-${id}`, `resident-${id}`),
});

const comment = (
  id: string,
  createdAt: string,
  sourcePost: ReturnType<typeof post>,
  content = 'A thoughtful follow-up.',
  parentComment: {
    id: string;
    createdAt: string;
    content: string;
    author: ReturnType<typeof author>;
  } | null = null,
) => ({
  id,
  postId: sourcePost.id,
  parentCommentId: parentComment?.id ?? null,
  content,
  createdAt: new Date(createdAt),
  author: author(`member-${id}`, `resident-${id}`),
  post: sourcePost,
  parentComment: parentComment
    ? {
        createdAt: new Date(parentComment.createdAt),
        content: parentComment.content,
        author: parentComment.author,
      }
    : null,
});

type TestNarrativeRow = {
  worldId: string;
  recentEvents: string | null;
  storySoFar: string | null;
  continuitySummary: string;
  lastPostAt: Date | null;
  lastPostId: string | null;
  lastCommentAt: Date | null;
  lastCommentId: string | null;
};

const emptyNarrative: TestNarrativeRow = {
  worldId: world.id,
  recentEvents: null,
  storySoFar: null,
  continuitySummary: '',
  lastPostAt: null,
  lastPostId: null,
  lastCommentAt: null,
  lastCommentId: null,
};

const output = {
  recentEvents: 'The latest town conversation is taking shape.',
  storyContinuation:
    'The town began with a handful of voices finding one another.',
  continuitySummary: 'The town is shaped by several distinct resident voices.',
};

function createService() {
  const prisma = {
    worldNarrative: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    worldMember: { findMany: jest.fn().mockResolvedValue([]) },
    post: { findMany: jest.fn() },
    comment: { findMany: jest.fn() },
  };
  const worldService = {
    findById: jest.fn().mockResolvedValue(world),
    getBySlug: jest.fn().mockResolvedValue(world),
  };
  const provider = {
    generateStructured: jest.fn().mockResolvedValue({
      output,
      telemetry: {
        source: 'mock',
        model: 'fixture-model',
        latencyMs: 1,
      },
    }),
  };
  const queue = { add: jest.fn().mockResolvedValue({}) };
  const service = new WorldNarrativeService(
    prisma as never,
    worldService as never,
    provider as unknown as LlmProvider,
    queue as never,
    undefined as never,
  );
  return { service, prisma, worldService, provider, queue };
}

function updatedNarrative(
  current: TestNarrativeRow,
  data: Record<string, unknown>,
) {
  return { ...current, ...data };
}

describe('WorldNarrativeService', () => {
  it('drains existing history in bounded chronological batches', async () => {
    const { service, prisma, provider } = createService();
    const history = Array.from(
      { length: NARRATIVE_BATCH_SIZE + 1 },
      (_, index) =>
        post(
          `post-${index}`,
          `2026-08-01T${String(index).padStart(2, '0')}:00:00.000Z`,
        ),
    );
    let postRead = 0;
    let saved = emptyNarrative;
    prisma.worldNarrative.findUnique.mockResolvedValue(emptyNarrative);
    prisma.post.findMany.mockImplementation(() => {
      postRead += 1;
      return Promise.resolve(
        postRead === 1 ? history : postRead === 2 ? [history.at(-1)] : [],
      );
    });
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        saved = { ...saved, ...data } as TestNarrativeRow;
        return Promise.resolve(saved);
      },
    );

    await service.processWorld(world.id);

    expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    expect(provider.generateStructured.mock.calls[0][0].prompt.user).toContain(
      'post-19',
    );
    expect(provider.generateStructured.mock.calls[1][0].prompt.user).toContain(
      `post-${NARRATIVE_BATCH_SIZE}`,
    );
    expect(saved.lastPostId).toBe(`post-${NARRATIVE_BATCH_SIZE}`);
  });

  it('processes existing posts and comments in chronological order on the first run', async () => {
    const { service, prisma, provider } = createService();
    const firstPost = post('post-1', '2026-08-01T01:00:00.000Z');
    const firstComment = comment(
      'comment-1',
      '2026-08-01T02:00:00.000Z',
      firstPost,
    );
    prisma.worldNarrative.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(emptyNarrative);
    prisma.worldNarrative.create.mockResolvedValue(emptyNarrative);
    prisma.post.findMany
      .mockResolvedValueOnce([firstPost])
      .mockResolvedValue([]);
    prisma.comment.findMany
      .mockResolvedValueOnce([firstComment])
      .mockResolvedValue([]);
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(updatedNarrative(emptyNarrative, data)),
    );

    await service.processWorld(world.id);

    expect(provider.generateStructured).toHaveBeenCalledTimes(1);
    const prompt = provider.generateStructured.mock.calls[0][0].prompt;
    expect(prompt.user).toContain('post-1');
    expect(prompt.user).toContain('comment-1');
    expect(prompt.user).toContain('Source timestamp: 2026-08-01T01:00:00.000Z');
    expect(prompt.user).toContain('Source timestamp: 2026-08-01T02:00:00.000Z');
    expect(prompt.system).toContain(
      'simple, natural English with the low reading effort of a clear young-adult novel',
    );
    expect(prompt.system).toContain(
      'End Recent Events with one short, specific question',
    );
    expect(prompt.system).toContain(
      'Use exact @handles whenever referring to residents; do not use personal pronouns for residents or infer gender.',
    );
    expect(prompt.system).toContain(
      'Do not include calendar dates, clock readings, times of day, or elapsed-day counts in published prose',
    );
    expect(prisma.worldNarrative.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lastPostId: firstPost.id,
          lastCommentId: firstComment.id,
        }),
      }),
    );
  });

  it('publishes source resident handles with an @ prefix in both narratives', async () => {
    const { service, prisma, provider } = createService();
    const sourcePost = post(
      'post-handle',
      '2026-08-01T01:00:00.000Z',
      'A new town observation.',
    );
    prisma.worldNarrative.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(emptyNarrative);
    prisma.worldNarrative.create.mockResolvedValue(emptyNarrative);
    prisma.worldMember.findMany.mockResolvedValue([
      { character: { handle: 'papercomet' } },
    ]);
    prisma.post.findMany
      .mockResolvedValueOnce([sourcePost])
      .mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);
    provider.generateStructured.mockResolvedValue({
      output: {
        recentEvents: 'papercomet noticed the change.',
        storyContinuation: 'papercomet started the observation.',
        continuitySummary: 'The observation remains open.',
      },
      telemetry: { source: 'mock', model: 'fixture-model', latencyMs: 1 },
    });
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(updatedNarrative(emptyNarrative, data)),
    );

    await service.processWorld(world.id);

    expect(prisma.worldNarrative.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recentEvents: '@papercomet noticed the change.',
          storySoFar: '@papercomet started the observation.',
        }),
      }),
    );
  });

  it('uses saved cursors for incremental activity without repeating prior content', async () => {
    const { service, prisma, provider } = createService();
    const oldPost = post('post-old', '2026-08-01T01:00:00.000Z');
    const newPost = post('post-new', '2026-08-02T01:00:00.000Z');
    const current = {
      ...emptyNarrative,
      recentEvents: 'Earlier events.',
      storySoFar: 'The opening chapter.\n\nThe latest chapter.',
      continuitySummary: 'An established fact.',
      lastPostAt: oldPost.createdAt,
      lastPostId: oldPost.id,
    };
    prisma.worldNarrative.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current);
    prisma.post.findMany.mockResolvedValueOnce([newPost]).mockResolvedValue([]);
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(updatedNarrative(current, data)),
    );

    await service.processWorld(world.id);

    const prompt = provider.generateStructured.mock.calls[0][0].prompt;
    expect(prompt.user).toContain('post-new');
    expect(prompt.user).not.toContain('post-old');
    expect(prompt.user).toContain(
      'Previous Story Ending (continuity only; do not repeat it):\nThe latest chapter.',
    );
    expect(prompt.user).not.toContain('The opening chapter.');
    expect(prompt.user).toContain('Source timestamp: 2026-08-02T01:00:00.000Z');
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { createdAt: { gt: oldPost.createdAt } },
            { createdAt: oldPost.createdAt, id: { gt: oldPost.id } },
          ],
        }),
      }),
    );
  });

  it('does not advance a cursor when narration fails, so a retry sees the same activity', async () => {
    const { service, prisma, provider } = createService();
    const newPost = post('post-retry', '2026-08-02T01:00:00.000Z');
    let postRead = 0;
    let saved = emptyNarrative;
    prisma.worldNarrative.findUnique.mockResolvedValue(emptyNarrative);
    prisma.post.findMany.mockImplementation(() => {
      postRead += 1;
      return Promise.resolve(postRead < 3 ? [newPost] : []);
    });
    prisma.comment.findMany.mockResolvedValue([]);
    provider.generateStructured
      .mockRejectedValueOnce(new Error('Provider unavailable'))
      .mockResolvedValueOnce({
        output,
        telemetry: { source: 'mock', model: 'fixture-model', latencyMs: 1 },
      });
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) => {
        saved = { ...saved, ...data } as TestNarrativeRow;
        return Promise.resolve(saved);
      },
    );

    await expect(service.processWorld(world.id)).rejects.toThrow(
      'Provider unavailable',
    );
    expect(prisma.worldNarrative.update).not.toHaveBeenCalled();

    await service.processWorld(world.id);

    expect(provider.generateStructured).toHaveBeenCalledTimes(2);
    expect(prisma.worldNarrative.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastPostId: newPost.id }),
      }),
    );
  });

  it('can advance past a routine comment while retaining the visible narrative', async () => {
    const { service, prisma, provider } = createService();
    const sourcePost = post('post-old', '2026-08-01T01:00:00.000Z');
    const current = {
      ...emptyNarrative,
      recentEvents: 'The existing briefing.',
      storySoFar: 'The existing story.',
      continuitySummary: 'An established fact.',
    };
    const routineComment = comment(
      'comment-routine',
      '2026-08-02T01:00:00.000Z',
      sourcePost,
      'Yep.',
    );
    prisma.worldNarrative.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current);
    prisma.post.findMany.mockResolvedValue([]);
    prisma.comment.findMany
      .mockResolvedValueOnce([routineComment])
      .mockResolvedValue([]);
    provider.generateStructured.mockResolvedValue({
      output: {
        recentEvents: null,
        storyContinuation: null,
        continuitySummary: 'An established fact.',
      },
      telemetry: { source: 'mock', model: 'fixture-model', latencyMs: 1 },
    });
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(updatedNarrative(current, data)),
    );

    await service.processWorld(world.id);

    expect(prisma.worldNarrative.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          recentEvents: current.recentEvents,
          storySoFar: current.storySoFar,
          lastCommentId: routineComment.id,
        }),
      }),
    );
    const prompt = provider.generateStructured.mock.calls[0][0].prompt;
    expect(prompt.user).toContain('Original post by @resident-post-old');
  });

  it('keeps a meaningful revival in new activity order with older post context', async () => {
    const { service, prisma, provider } = createService();
    const sourcePost = post(
      'post-old',
      '2026-08-01T01:00:00.000Z',
      'The old workshop ledger is still unexplained.',
    );
    const revival = comment(
      'comment-revival',
      '2026-08-03T01:00:00.000Z',
      sourcePost,
      'I found another clue in the ledger.',
    );
    const current = {
      ...emptyNarrative,
      lastPostAt: sourcePost.createdAt,
      lastPostId: sourcePost.id,
    };
    prisma.worldNarrative.findUnique
      .mockResolvedValueOnce(current)
      .mockResolvedValueOnce(current);
    prisma.post.findMany.mockResolvedValue([]);
    prisma.comment.findMany
      .mockResolvedValueOnce([revival])
      .mockResolvedValue([]);
    prisma.worldNarrative.update.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve(updatedNarrative(current, data)),
    );

    await service.processWorld(world.id);

    expect(provider.generateStructured.mock.calls[0][0].prompt.user).toEqual(
      expect.stringContaining('The old workshop ledger is still unexplained.'),
    );
    expect(prisma.worldNarrative.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ lastCommentId: revival.id }),
      }),
    );
  });

  it('swallows queue failures so the saved action can complete and keeps private fields out of reads', async () => {
    const { service, prisma, worldService, queue } = createService();
    queue.add.mockRejectedValue(new Error('Redis unavailable'));
    await expect(service.enqueue(world.id)).resolves.toBeUndefined();

    prisma.worldNarrative.findUnique.mockResolvedValue({
      recentEvents: 'Public briefing.',
      storySoFar: 'Public story.',
      continuitySummary: 'Private fact.',
      lastPostAt: null,
      lastPostId: null,
      lastCommentAt: null,
      lastCommentId: null,
      worldId: world.id,
    });
    await expect(service.findByWorldSlug(world.slug)).resolves.toEqual({
      recentEvents: 'Public briefing.',
      storySoFar: 'Public story.',
    });
    expect(prisma.worldNarrative.findUnique).toHaveBeenCalledWith({
      where: { worldId: world.id },
      select: { recentEvents: true, storySoFar: true },
    });

    worldService.getBySlug.mockResolvedValue(null);
    await expect(service.findByWorldSlug('missing')).resolves.toBeNull();
    expect(prisma.worldNarrative.findUnique).toHaveBeenCalledTimes(1);
  });
});
