import { worldNarrativeOutputSchema } from '@/simulation/narrative/world-narrative-output.schema';
import { WorldNarrativeService } from '@/simulation/narrative/world-narrative.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { WorldService, WorldView } from '@/world/world.service';

const world: WorldView = {
  id: 'world-1',
  name: 'The House',
  slug: 'the-house',
  description: { premise: 'A shared home.' },
  rules: ['Be kind'],
  topicScope: 'Roommate life',
  residentCount: 2,
  isActive: true,
  createdAt: new Date('2026-09-01T00:00:00.000Z'),
  updatedAt: new Date('2026-09-01T00:00:00.000Z'),
};

function createNarrative(overrides: {
  outputs?: Array<{
    recentEvents: string;
    storyContinuation: string;
    continuitySummary: string;
  }>;
  posts?: unknown[];
  comments?: unknown[];
  existing?: Record<string, unknown> | null;
}) {
  let narrative = overrides.existing ?? null;
  const prisma = {
    worldNarrative: {
      findUnique: jest
        .fn()
        .mockImplementation(() => Promise.resolve(narrative)),
      upsert: jest.fn().mockImplementation(({ create, update }) => {
        narrative = { ...(narrative ? update : create) };
        return Promise.resolve(narrative);
      }),
    },
    post: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(overrides.posts ?? [])
        .mockResolvedValue([]),
    },
    comment: {
      findMany: jest
        .fn()
        .mockResolvedValueOnce(overrides.comments ?? [])
        .mockResolvedValue([]),
    },
    $transaction: jest.fn().mockImplementation((callback) => callback(prisma)),
  } as unknown as import('@/lib/database/prisma.service').PrismaService;
  const generateStructured = jest
    .fn()
    .mockImplementation(async ({ schema }: { schema: unknown }) => {
      const output = (overrides.outputs ?? [])[0];
      if (!output) throw new Error('No output fixture');
      expect(schema).toBe(worldNarrativeOutputSchema);
      overrides.outputs!.shift();
      return {
        output,
        telemetry: { source: 'test', model: 'test', latencyMs: 1 },
      };
    });
  const provider = { generateStructured } as unknown as LlmProvider;
  const worldService = {
    findById: jest.fn().mockResolvedValue(world),
    getBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as WorldService;

  return {
    service: new WorldNarrativeService(prisma, worldService, provider),
    prisma,
    provider,
    generateStructured,
    getNarrative: () => narrative,
  };
}

const post = {
  id: 'post-1',
  title: 'The missing mug',
  content: 'The blue mug is gone again.',
  createdAt: new Date('2026-09-02T00:00:00.000Z'),
  author: { character: { handle: 'readthemanual' }, user: null },
};

const comment = {
  id: 'comment-1',
  content: 'It is on the top shelf.',
  createdAt: new Date('2026-09-02T00:01:00.000Z'),
  author: { character: { handle: 'leftsnacks' }, user: null },
  post: {
    title: post.title,
    content: post.content,
    author: post.author,
  },
};

describe('WorldNarrativeService', () => {
  it('generates a chronological batch with exact handles and parent context', async () => {
    const fixture = createNarrative({
      posts: [post],
      comments: [comment],
      outputs: [
        {
          recentEvents:
            '@readthemanual found the mug, and @leftsnacks knows where it is.',
          storyContinuation:
            '@readthemanual noticed the missing mug. @leftsnacks answered from the top shelf.',
          continuitySummary: 'The blue mug is on the top shelf.',
        },
      ],
    });

    await fixture.service.narrate(world.id);

    expect(fixture.generateStructured).toHaveBeenCalledTimes(1);
    const prompt = fixture.generateStructured.mock.calls[0][0].prompt;
    expect(prompt.system).toContain('young-adult reading level');
    expect(prompt.system).toContain('never infer gender');
    expect(prompt.user).toContain('author: @readthemanual');
    expect(prompt.user).toContain('author: @leftsnacks');
    expect(prompt.user).toContain('parent post title: The missing mug');
    expect(fixture.getNarrative()).toMatchObject({
      recentEvents:
        '@readthemanual found the mug, and @leftsnacks knows where it is.',
      lastPostId: 'post-1',
      lastCommentId: 'comment-1',
    });
  });

  it('advances routine activity while preserving public prose and replacing private notes', async () => {
    const fixture = createNarrative({
      existing: {
        recentEvents: 'The old briefing.',
        storySoFar: 'The old story.',
        continuitySummary: 'Stale detail.',
        lastPostAt: null,
        lastPostId: null,
        lastCommentAt: null,
        lastCommentId: null,
      },
      comments: [comment],
      outputs: [
        { recentEvents: '', storyContinuation: '', continuitySummary: '' },
      ],
    });

    await fixture.service.narrate(world.id);

    expect(fixture.getNarrative()).toMatchObject({
      recentEvents: 'The old briefing.',
      storySoFar: 'The old story.',
      continuitySummary: '',
      lastCommentId: 'comment-1',
    });
  });

  it('does not advance source positions when generation fails', async () => {
    const fixture = createNarrative({ posts: [post], outputs: [] });
    fixture.generateStructured.mockRejectedValue(
      new Error('provider unavailable'),
    );

    await expect(fixture.service.narrate(world.id)).rejects.toThrow(
      'provider unavailable',
    );
    expect(fixture.prisma.worldNarrative.upsert).not.toHaveBeenCalled();
  });
});
