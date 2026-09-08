import { CharactersService } from '@/characters/characters.service';
import { CommentsService } from '@/comments/comments.service';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostsService } from '@/posts/posts.service';
import { LlmProvider } from '@/simulation/providers/llm-provider.port';
import { MockLlmProvider } from '@/simulation/providers/mock/mock-llm.provider';
import {
  FetchLike,
  OpenAiCompatibleLlmProvider,
} from '@/simulation/providers/openai-compatible/openai-compatible-llm.provider';
import { VotesService } from '@/votes/votes.service';
import { WorldMembersService } from '@/world-members/world-members.service';
import { WorldService } from '@/world/world.service';

import { SimulationContextProvider } from './simulation-context-provider';
import { StubLlmProvider } from './stub-llm.provider';
import { VoteAction } from './vote.action';

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

function mockConfig() {
  return loadProviderConfig({
    LLM_PROVIDER: 'mock',
    LLM_MODEL: 'fixture-model',
  });
}

function createAction(
  overrides: {
    post?: typeof post | null;
    provider?: LlmProvider;
    output?: { decision: string; reasoning: string };
    currentVote?: 1 | -1 | null;
  } = {},
) {
  const worldRepository = {
    getBySlug: jest.fn().mockResolvedValue(world),
  } as unknown as WorldService;
  const characterRepository = {
    getById: jest.fn().mockResolvedValue(character),
  } as unknown as CharactersService;
  const worldMemberRepository = {
    findActiveByWorldAndCharacter: jest.fn().mockResolvedValue({
      id: 'member-1',
    }),
  } as unknown as WorldMembersService;
  const postRepository = {
    findById: jest
      .fn()
      .mockResolvedValue(overrides.post === undefined ? post : overrides.post),
  } as unknown as PostsService;
  const commentRepository = {} as unknown as CommentsService;

  const contextProvider = new SimulationContextProvider(
    worldRepository,
    characterRepository,
    worldMemberRepository,
    postRepository,
    commentRepository,
  );

  const voteRepository = {
    findByMemberAndPost: jest
      .fn()
      .mockResolvedValue(
        overrides.currentVote === null || overrides.currentVote === undefined
          ? null
          : { id: 'vote-1', value: overrides.currentVote },
      ),
  } as unknown as jest.Mocked<VotesService>;

  const provider =
    overrides.provider ??
    new MockLlmProvider(mockConfig(), [
      {
        id: 'vote',
        output: overrides.output ?? {
          decision: 'upvote',
          reasoning: 'Clear point.',
        },
      },
    ]);

  return {
    action: new VoteAction(contextProvider, provider, voteRepository),
    voteRepository,
  };
}

const input = {
  worldSlug: 'mbti-house',
  characterId: 'character-1',
  postId: 'post-1',
};

describe('VoteAction', () => {
  it.each(['upvote', 'downvote', 'skip'] as const)(
    'parses a %s decision into a VoteDecision',
    async (decision) => {
      const { action } = createAction({
        output: { decision, reasoning: 'Because.' },
      });

      const result = await action.execute(input);

      expect(result).toMatchObject({
        status: 'success',
        decision: {
          action: 'VOTE',
          worldId: 'world-1',
          memberId: 'member-1',
          characterId: 'character-1',
          postId: 'post-1',
          decision,
          reasoning: 'Because.',
        },
      });
    },
  );

  it('uses the post context in the composed prompt', async () => {
    const provider = new StubLlmProvider(mockConfig(), {
      decision: 'skip',
      reasoning: 'R',
    });
    const { action } = createAction({ provider });

    await action.execute(input);

    const prompt = provider.lastPrompt();
    expect(prompt.system).toContain('VOTE');
    expect(prompt.system).toContain(
      '{"decision": "upvote" | "downvote" | "skip", "reasoning": string}',
    );
    expect(prompt.user).toContain('@steady_hands (Steady_Hands)');
    expect(prompt.user).toContain('"A thought" by @other');
    expect(prompt.user).toContain('Body text.');
    expect(prompt.user).toContain('No current vote.');
  });

  it.each([
    { currentVote: 1 as const, decision: 'upvote' as const },
    { currentVote: 1 as const, decision: 'downvote' as const },
    { currentVote: -1 as const, decision: 'downvote' as const },
    { currentVote: -1 as const, decision: 'upvote' as const },
  ])(
    'treats $decision as the desired state when the current vote is $currentVote',
    async ({ currentVote, decision }) => {
      const { action, voteRepository } = createAction({
        currentVote,
        output: { decision, reasoning: 'Changed my mind.' },
      });

      const result = await action.execute(input);

      expect(voteRepository.findByMemberAndPost).toHaveBeenCalledWith(
        'member-1',
        'post-1',
      );
      expect(result).toMatchObject({
        status: 'success',
        decision: { decision, reasoning: 'Changed my mind.' },
      });
    },
  );

  it('fails when the target post is missing in the World', async () => {
    const { action } = createAction({ post: null });

    const result = await action.execute(input);

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'POST_NOT_FOUND' },
    });
  });

  it('fails when the provider returns an invalid decision', async () => {
    const { action } = createAction({
      output: { decision: 'bogus', reasoning: 'R' },
    });

    const result = await action.execute(input);

    expect(result).toMatchObject({
      status: 'failed',
      failure: { code: 'MALFORMED_RESPONSE' },
    });
  });

  it('produces the same decision when the provider switches to the OpenCode Go adapter', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        id: 'fixture-completion-id',
        object: 'chat.completion',
        model: 'deepseek-v4-flash',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: '{"decision":"upvote","reasoning":"Clear point."}',
            },
            finish_reason: 'stop',
          },
        ],
        usage: { prompt_tokens: 124, completion_tokens: 51, total_tokens: 175 },
      }),
    });
    const provider = new OpenAiCompatibleLlmProvider(
      loadProviderConfig({
        LLM_PROVIDER: 'openai-compatible',
        LLM_BASE_URL: 'https://opencode.ai/zen/go/v1',
        LLM_API_KEY: 'fixture-api-key',
        LLM_MODEL: 'deepseek-v4-flash',
        LLM_STRUCTURED_OUTPUT: 'json-object',
      }),
      fetchMock as unknown as FetchLike,
    );
    const { action } = createAction({ provider });

    const result = await action.execute(input);

    expect(result).toMatchObject({
      status: 'success',
      decision: {
        action: 'VOTE',
        decision: 'upvote',
        reasoning: 'Clear point.',
      },
    });
  });
});
