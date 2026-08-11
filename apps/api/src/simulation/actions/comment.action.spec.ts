import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

import { CommentAction } from './comment.action';
import { SimulationContextProvider } from './simulation-context-provider';
import { StubLlmProvider } from './stub-llm.provider';

const world = {
  id: 'world-1',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: null,
  rules: ['Rule one'],
  topicScope: 'Personality debates',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const character = {
  id: 'character-1',
  handle: 'steady_hands',
  name: 'Steady_Hands',
  classification: 'ISFJ',
  classificationGroup: 'SJ',
  avatarUrl: null,
  biography: 'Remembers birthdays.',
  traits: ['Loyal'],
  systemPrompt: 'You are Steady_Hands.',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const post = {
  id: 'post-1',
  title: 'A thought',
  content: 'Body text.',
  voteScore: 3,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  author: {
    id: 'member-2',
    handle: 'other',
    name: 'Other',
    avatarUrl: null,
  },
};

const comments = [
  {
    id: 'comment-2',
    postId: 'post-1',
    parentCommentId: 'comment-1',
    author: {
      id: 'member-3',
      handle: 'another',
      name: 'Another',
      avatarUrl: null,
    },
    content: 'A reply.',
    voteScore: 0,
    createdAt: new Date('2026-01-03'),
    updatedAt: new Date('2026-01-03'),
    postTitle: 'A thought',
  },
  {
    id: 'comment-1',
    postId: 'post-1',
    parentCommentId: null,
    author: { id: 'member-4', handle: 'root', name: 'Root', avatarUrl: null },
    content: 'A root comment.',
    voteScore: 1,
    createdAt: new Date('2026-01-02'),
    updatedAt: new Date('2026-01-02'),
    postTitle: 'A thought',
  },
];

function mockConfig() {
  return loadProviderConfig({
    LLM_PROVIDER: 'mock',
    LLM_MODEL: 'fixture-model',
  });
}

function createAction(
  overrides: {
    provider?: MockLlmProvider | StubLlmProvider;
    thread?: typeof comments;
    output?: {
      content: string;
      parentCommentId: string | null;
      reasoning: string;
    };
  } = {},
) {
  const worldRepository = {
    findBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as WorldRepository;
  const characterRepository = {
    findById: jest.fn().mockResolvedValue(character),
  } as unknown as CharacterRepository;
  const worldMemberRepository = {
    findActiveByWorldAndCharacter: jest.fn().mockResolvedValue({
      id: 'member-1',
    }),
  } as unknown as WorldMemberRepository;
  const postRepository = {
    findById: jest.fn().mockResolvedValue(post),
  } as unknown as PostRepository;
  const commentRepository = {
    findByPostId: jest
      .fn()
      .mockResolvedValue(
        overrides.thread === undefined ? comments : overrides.thread,
      ),
  } as unknown as CommentRepository;

  const contextProvider = new SimulationContextProvider(
    worldRepository,
    characterRepository,
    worldMemberRepository,
    postRepository,
    commentRepository,
  );

  const provider =
    overrides.provider ??
    new MockLlmProvider(mockConfig(), [
      {
        id: 'comment',
        output: overrides.output ?? {
          content: 'I see it the same way.',
          parentCommentId: null,
          reasoning: 'Agreement.',
        },
      },
    ]);

  return new CommentAction(contextProvider, provider);
}

const command = {
  action: 'COMMENT' as const,
  worldSlug: 'mbti-house',
  characterId: 'character-1',
  postId: 'post-1',
};

describe('CommentAction', () => {
  it('produces a CommentDecision from mock output', async () => {
    const action = createAction({});

    const result = await action.execute(command);

    expect(result).toMatchObject({
      status: 'success',
      decision: {
        action: 'COMMENT',
        worldId: 'world-1',
        memberId: 'member-1',
        characterId: 'character-1',
        postId: 'post-1',
        content: 'I see it the same way.',
        parentCommentId: null,
        reasoning: 'Agreement.',
      },
    });
  });

  it('uses the post and bounded thread context in the composed prompt', async () => {
    const provider = new StubLlmProvider(mockConfig(), {
      content: 'C',
      parentCommentId: null,
      reasoning: 'R',
    });
    const action = createAction({ provider });

    await action.execute(command);

    const prompt = provider.lastPrompt();
    expect(prompt.system).toContain('COMMENT');
    expect(prompt.system).toContain(
      '{"content": string, "parentCommentId": string | null, "reasoning": string}',
    );
    expect(prompt.user).toContain('"A thought" by @other');
    expect(prompt.user).toContain('@root: A root comment.');
    expect(prompt.user).toContain('@another: A reply.');
  });

  it('falls back to the command parent when the provider omits one', async () => {
    const provider = new StubLlmProvider(mockConfig(), {
      content: 'C',
      parentCommentId: null,
      reasoning: 'R',
    });
    const action = createAction({ provider });

    const result = await action.execute({
      ...command,
      parentCommentId: 'comment-1',
    });

    expect(result).toMatchObject({
      status: 'success',
      decision: { parentCommentId: 'comment-1' },
    });
  });

  it('includes the command parent chain in the thread context prompt', async () => {
    const deepThread = Array.from({ length: 8 }, (_, index) => ({
      id: `deep-${index}`,
      postId: 'post-1',
      parentCommentId: index > 0 ? `deep-${index - 1}` : null,
      author: {
        id: `m-${index}`,
        handle: `h${index}`,
        name: `H${index}`,
        avatarUrl: null,
      },
      content: `Comment ${index}.`,
      voteScore: 0,
      createdAt: new Date(`2026-01-0${index + 1}`),
      updatedAt: new Date(`2026-01-0${index + 1}`),
      postTitle: 'A thought',
    }));
    const provider = new StubLlmProvider(mockConfig(), {
      content: 'C',
      parentCommentId: null,
      reasoning: 'R',
    });
    const action = createAction({ provider, thread: deepThread });

    await action.execute({ ...command, parentCommentId: 'deep-0' });

    expect(provider.lastPrompt().user).toContain('@h0: Comment 0.');
  });
});
