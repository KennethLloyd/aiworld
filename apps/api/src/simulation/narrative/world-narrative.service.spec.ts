import type { WorldView } from '@/world/world.service';

import { WorldNarrativeService } from './world-narrative.service';

const world: WorldView = {
  id: 'world-1',
  name: 'Test World',
  slug: 'test-world',
  description: null,
  rules: [],
  topicScope: 'A small shared house',
  residentCount: 2,
  isActive: true,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

const narrative = {
  worldId: world.id,
  recentEvents: null,
  storySoFar: null,
  continuitySummary: '',
  lastPostAt: null,
  lastPostId: null,
  lastCommentAt: null,
  lastCommentId: null,
};

function eventTime(minutes: number): Date {
  return new Date(Date.UTC(2026, 8, 1, 0, minutes));
}

function post(index: number, content = `Post ${index}`) {
  return {
    id: `post-${index}`,
    title: `Post ${index}`,
    content,
    createdAt: eventTime(index),
    author: {
      character: { handle: 'resident', name: 'Resident' },
      user: null,
    },
  };
}

function comment(index: number, createdAt: Date) {
  return {
    id: `comment-${index}`,
    content: `Comment ${index}`,
    createdAt,
    author: {
      character: { handle: 'commenter', name: 'Commenter' },
      user: null,
    },
    post: post(0),
  };
}

function createService({
  posts,
  comments,
}: {
  posts: ReturnType<typeof post>[];
  comments: ReturnType<typeof comment>[];
}) {
  const update = jest.fn().mockResolvedValue(undefined);
  const add = jest.fn().mockResolvedValue(undefined);
  const generateStructured = jest.fn().mockResolvedValue({
    output: {
      recentEvents: 'A new event is unfolding.',
      storyContinuation: 'The residents continue their shared work.',
      continuitySummary: 'Residents are working together.',
    },
    telemetry: {
      source: 'test',
      model: 'test',
      latencyMs: 1,
    },
  });
  const prisma = {
    worldNarrative: {
      upsert: jest.fn().mockResolvedValue(narrative),
      update,
    },
    post: { findMany: jest.fn().mockResolvedValue(posts) },
    comment: { findMany: jest.fn().mockResolvedValue(comments) },
  };
  const worldService = {
    findById: jest.fn().mockResolvedValue(world),
  };
  const service = new WorldNarrativeService(
    prisma as never,
    worldService as never,
    { generateStructured } as never,
    { add, opts: { connection: {} } } as never,
  );

  return { service, update, add, generateStructured, prisma };
}

async function process(service: WorldNarrativeService) {
  await (
    service as unknown as {
      process(job: { data: { worldId: string } }): Promise<void>;
    }
  ).process({ data: { worldId: world.id } });
}

describe('WorldNarrativeService source batching', () => {
  it('keeps posts and comments in one global chronological batch', async () => {
    const posts = Array.from({ length: 45 }, (_, index) => post(index));
    const comments = [comment(1, new Date(eventTime(42).getTime() + 30_000))];
    const { service, generateStructured, update, add } = createService({
      posts,
      comments,
    });

    await process(service);

    const prompt = generateStructured.mock.calls[0][0].prompt.user;
    expect(prompt).toContain('id=post-39');
    expect(prompt).not.toContain('id=post-40');
    expect(prompt).not.toContain('id=comment-1');
    expect(update).toHaveBeenCalledWith({
      where: { worldId: world.id },
      data: expect.objectContaining({ lastPostId: 'post-39' }),
    });
    expect(update.mock.calls[0][0].data).not.toHaveProperty('lastCommentId');
    expect(add).toHaveBeenCalledTimes(1);
  });

  it('advances cursors only through source activity included in the prompt budget', async () => {
    const posts = Array.from({ length: 41 }, (_, index) =>
      post(index, 'x'.repeat(10_000)),
    );
    const { service, generateStructured, update, add } = createService({
      posts,
      comments: [],
    });

    await process(service);

    const prompt = generateStructured.mock.calls[0][0].prompt.user;
    const sourceActivity = prompt
      .split('NEW SOURCE ACTIVITY\n')[1]
      .split('\n\nEXISTING RECENT EVENTS')[0];
    const includedIds = [...sourceActivity.matchAll(/id=(post-\d+)/g)].map(
      ([, id]) => id,
    );
    const lastIncludedId = includedIds.at(-1);
    expect(includedIds.length).toBeGreaterThan(0);
    expect(includedIds.length).toBeLessThan(posts.length);
    expect(lastIncludedId).toBeDefined();
    expect(sourceActivity.length).toBeLessThanOrEqual(14_000);
    expect(update).toHaveBeenCalledWith({
      where: { worldId: world.id },
      data: expect.objectContaining({ lastPostId: lastIncludedId }),
    });
    expect(add).toHaveBeenCalledTimes(1);
  });
});
