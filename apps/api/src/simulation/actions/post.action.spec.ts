import { CharactersService } from '@/characters/characters.service';
import { CommentsService } from '@/comments/comments.service';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostsService } from '@/posts/posts.service';
import type { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import { WorldMembersService } from '@/world-members/world-members.service';
import { WorldService } from '@/world/world.service';

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
  member?: {
    id: string;
    narrativeMemory: string;
    recentEvents: string | null;
  } | null;
  provider?: MockLlmProvider | StubLlmProvider;
}) {
  const worldRepository = {
    getBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as WorldService;
  const characterRepository = {
    getById: jest
      .fn()
      .mockResolvedValue(
        overrides.character === undefined ? character : overrides.character,
      ),
  } as unknown as CharactersService;
  const worldMemberRepository = {
    findActiveByWorldAndCharacter: jest
      .fn()
      .mockResolvedValue(
        overrides.member === undefined
          ? { id: 'member-1', narrativeMemory: '', recentEvents: null }
          : overrides.member,
      ),
  } as unknown as WorldMembersService;
  const postRepository = {
    findByAuthorMembership: jest.fn().mockResolvedValue([]),
  } as unknown as PostsService;
  const commentRepository = {} as unknown as CommentsService;

  const contextProvider = new SimulationContextProvider(
    worldRepository,
    characterRepository,
    worldMemberRepository,
    postRepository,
    commentRepository,
  );

  const provider =
    overrides.provider ??
    ({ generateStructured: jest.fn() } as unknown as LlmProvider);

  return new PostAction(contextProvider, provider);
}

const input = {
  worldSlug: 'mbti-house',
  characterId: 'character-1',
};

describe('PostAction', () => {
  it('never selects an inactive character', async () => {
    const action = createAction({ character: null });

    const result = await action.execute(input);

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

    const result = await action.execute(input);

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

    const result = await action.execute(input);

    expect(result).toMatchObject({
      status: 'failed',
      failure: {
        code: 'MALFORMED_RESPONSE',
        retryable: false,
        providerFailure: true,
      },
    });
  });

  it('returns an unsafe-output failure before a writer could persist content', async () => {
    const provider = new StubLlmProvider(mockConfig(), {
      title: 'A household note',
      content: '<script>alert(1)</script>',
      reasoning: 'The generated text is unsafe.',
    });
    const action = createAction({ provider });

    await expect(action.execute(input)).resolves.toMatchObject({
      status: 'failed',
      failure: { code: 'UNSAFE_OUTPUT', retryable: false },
    });
  });
});
