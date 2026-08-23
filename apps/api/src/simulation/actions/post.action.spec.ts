import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

import { PostAction } from './post.action';
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
  handle: 'standard_procedure',
  name: 'Standard_Procedure',
  classification: 'ISTJ',
  classificationGroup: 'SJ',
  avatarUrl: null,
  biography: 'Loves order.',
  traits: ['Rigid'],
  systemPrompt: 'You are Standard_Procedure.',
  isActive: true,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function mockConfig() {
  return loadProviderConfig({
    LLM_PROVIDER: 'mock',
    LLM_MODEL: 'fixture-model',
  });
}

function createAction(overrides: {
  character?: typeof character | null;
  member?: { id: string } | null;
  provider?: MockLlmProvider | StubLlmProvider;
}) {
  const worldRepository = {
    findBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as WorldRepository;
  const characterRepository = {
    findById: jest
      .fn()
      .mockResolvedValue(
        overrides.character === undefined ? character : overrides.character,
      ),
  } as unknown as CharacterRepository;
  const worldMemberRepository = {
    findActiveByWorldAndCharacter: jest
      .fn()
      .mockResolvedValue(
        overrides.member === undefined ? { id: 'member-1' } : overrides.member,
      ),
  } as unknown as WorldMemberRepository;
  const postRepository = {} as unknown as PostRepository;
  const commentRepository = {} as unknown as CommentRepository;

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
        id: 'post',
        output: {
          title: 'The quiet power of a pause',
          content: 'Wait before you speak.',
          reasoning: 'Timing over noise.',
        },
      },
    ]);

  return new PostAction(contextProvider, provider);
}

const command = {
  action: 'POST' as const,
  worldSlug: 'mbti-house',
  characterId: 'character-1',
};

describe('PostAction', () => {
  it('produces an actionable PostDecision from mock output', async () => {
    const action = createAction({});

    const result = await action.execute(command);

    expect(result).toMatchObject({
      status: 'success',
      decision: {
        action: 'POST',
        worldId: 'world-1',
        memberId: 'member-1',
        characterId: 'character-1',
        title: 'The quiet power of a pause',
        content: 'Wait before you speak.',
        reasoning: 'Timing over noise.',
      },
      telemetry: {
        source: 'mock',
        model: 'fixture-model',
      },
    });
  });

  it('composes the prompt from World, character, action, and output format', async () => {
    const provider = new StubLlmProvider(mockConfig(), {
      title: 'T',
      content: 'C',
      reasoning: 'R',
    });
    const action = createAction({ provider });

    await action.execute(command);

    const prompt = provider.lastPrompt();
    expect(prompt.system).toContain('POST');
    expect(prompt.system).toContain(
      '{"title": string, "content": string, "reasoning": string}',
    );
    expect(prompt.user).toContain('The MBTI House');
    expect(prompt.user).toContain('@standard_procedure (Standard_Procedure)');
    expect(prompt.user).toContain('Personality debates');
  });

  it('never selects an inactive character', async () => {
    const action = createAction({ character: null });

    const result = await action.execute(command);

    expect(result).toEqual({
      status: 'failed',
      failure: {
        code: 'CHARACTER_INACTIVE',
        message: expect.stringContaining('character-1'),
        retryable: false,
      },
    });
  });

  it('fails when the character has no active WorldMember membership', async () => {
    const action = createAction({ member: null });

    const result = await action.execute(command);

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'MEMBER_NOT_FOUND' },
    });
  });

  it('turns invalid provider output into a failed result, not a crash', async () => {
    const provider = new MockLlmProvider(mockConfig(), [
      { id: 'post', output: { title: '', content: '', reasoning: 'R' } },
    ]);
    const action = createAction({ provider });

    const result = await action.execute(command);

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'MALFORMED_RESPONSE', retryable: false },
    });
  });

  it('returns an unsafe-output failure before a writer could persist content', async () => {
    const provider = new StubLlmProvider(mockConfig(), {
      title: 'A household note',
      content: '<script>alert(1)</script>',
      reasoning: 'The generated text is unsafe.',
    });
    const action = createAction({ provider });

    await expect(action.execute(command)).resolves.toMatchObject({
      status: 'failed',
      failure: { code: 'UNSAFE_OUTPUT', retryable: false },
    });
  });
});
