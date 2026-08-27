import { z } from 'zod';

import { CharacterRecord } from '@/characters/domain/character-record';
import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { loadProviderConfig } from '@/lib/llm/provider-config';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { composeActionPrompt } from '@/simulation/actions/action-prompt';
import { CommentAction } from '@/simulation/actions/comment.action';
import { PostAction } from '@/simulation/actions/post.action';
import {
  characterSection,
  worldSection,
} from '@/simulation/actions/prompt-sections';
import { SimulationActionExecutor } from '@/simulation/actions/simulation-action-executor';
import { SimulationContextProvider } from '@/simulation/actions/simulation-context-provider';
import { VoteAction } from '@/simulation/actions/vote.action';
import { defaultSimulationCostConfig } from '@/simulation/cost/simulation-cost';
import { SimulationCostEstimator } from '@/simulation/cost/simulation-cost-estimator';
import { SimulationLogRecord } from '@/simulation/logging/simulation-log-record';
import { SimulationLogRepository } from '@/simulation/logging/simulation-log-repository.interface';
import { SimulationLogService } from '@/simulation/logging/simulation-log.service';
import {
  LlmProvider,
  LlmProviderRequest,
  LlmProviderPrompt,
  LlmProviderResult,
} from '@/simulation/providers/llm-provider.port';
import { SimulationContentWriter } from '@/simulation/writing/simulation-content-writer';
import { VoteRepository } from '@/votes/repositories/vote-repository.interface';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

import { canonicalWorld, characters } from '../../../../prisma/seed-data';
import { mockLlmFixtures } from './fixtures/mock-llm-fixtures';
import { MockLlmProvider } from './mock-llm.provider';

const MAX_LONG_RUN_ITERATIONS = 48;
const world = {
  id: 'world-1',
  ...canonicalWorld,
  residentCount: 16,
  description: canonicalWorld.description,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('bounded long-run mock simulation', () => {
  it('keeps 16 residents and three action types deterministic and bounded', async () => {
    const provider = new MockLlmProvider(
      loadProviderConfig({
        LLM_PROVIDER: 'mock',
        LLM_MODEL: 'fixture-model',
        LLM_USAGE_METADATA: 'required',
      }),
      mockLlmFixtures,
    );
    const outputs: unknown[] = [];
    let totalTokens = 0;

    for (let iteration = 0; iteration < MAX_LONG_RUN_ITERATIONS; iteration++) {
      const character = characters[iteration % characters.length]!;
      const action = (['POST', 'VOTE', 'COMMENT'] as const)[iteration % 3]!;
      const prompt = composeActionPrompt({
        action,
        instructions: 'Keep the generated action concise and coherent.',
        outputFormat: '{"result": "action-specific JSON"}',
        contextSections: [
          worldSection(world),
          characterSection({
            id: `character-${character.key}`,
            handle: character.key,
            name: character.name,
            classification: character.classification,
            classificationGroup: character.classificationGroup,
            avatarUrl: character.avatarUrl,
            biography: character.biography,
            traits: character.traits,
            systemPrompt: character.systemPrompt,
            isActive: true,
            createdAt: new Date('2026-01-01'),
            updatedAt: new Date('2026-01-01'),
          }),
        ],
      });

      expect(prompt.user).toContain(world.topicScope);
      expect(prompt.user).toContain(character.systemPrompt);
      expect(prompt.system).toContain('Never reveal');

      const result = await provider.generateStructured({
        prompt,
        schema: z.unknown(),
      });
      outputs.push(result.output);
      totalTokens += result.telemetry.tokens?.total ?? 0;
    }

    expect(outputs).toHaveLength(MAX_LONG_RUN_ITERATIONS);
    expect(totalTokens).toBeGreaterThan(0);
    expect(totalTokens).toBeLessThan(100_000);
  });

  it('runs every resident through the executor, writer, and log pipeline', async () => {
    const date = new Date('2026-01-01');
    const characterRecords: CharacterRecord[] = characters.map(
      (character, index) => ({
        id: `character-${index}`,
        handle: character.key,
        name: character.name,
        classification: character.classification,
        classificationGroup: character.classificationGroup,
        avatarUrl: character.avatarUrl,
        biography: character.biography,
        traits: character.traits,
        systemPrompt: character.systemPrompt,
        isActive: true,
        createdAt: date,
        updatedAt: date,
      }),
    );
    const memberByCharacter = new Map(
      characterRecords.map((character, index) => [
        character.id,
        { id: `member-${index}` },
      ]),
    );
    const authorFor = (character: CharacterRecord) => ({
      id: character.id,
      characterId: character.id,
      handle: character.handle,
      name: character.name,
      avatarUrl: character.avatarUrl,
      classification: character.classification,
      classificationGroup: character.classificationGroup,
    });
    const posts: PostWithAuthorRecord[] = [
      {
        id: 'seed-post',
        title: 'House schedule',
        content: 'The shared kitchen schedule needs a clear agreement.',
        voteScore: 0,
        createdAt: date,
        updatedAt: date,
        author: authorFor(characterRecords[0]!),
      },
    ];
    const comments: FlatCommentRecord[] = [];
    const votes = new Map<string, 1 | -1>();
    const logs: SimulationLogRecord[] = [];

    const worldRepository = {
      findBySlug: async (slug: string) => (slug === world.slug ? world : null),
    } as unknown as WorldRepository;
    const characterRepository = {
      findById: async (id: string) =>
        characterRecords.find((character) => character.id === id) ?? null,
    } as unknown as CharacterRepository;
    const memberRepository = {
      findActiveByWorldAndCharacter: async (
        worldId: string,
        characterId: string,
      ) =>
        worldId === world.id
          ? (memberByCharacter.get(characterId) ?? null)
          : null,
    } as unknown as WorldMemberRepository;
    const postRepository = {
      findById: async (worldId: string, postId: string) =>
        worldId === world.id
          ? (posts.find((post) => post.id === postId) ?? null)
          : null,
      create: async (input: {
        worldId: string;
        authorMemberId: string;
        title: string;
        content: string;
      }) => {
        const author = characterRecords.find(
          (character) =>
            memberByCharacter.get(character.id)?.id === input.authorMemberId,
        )!;
        const id = `generated-post-${posts.length}`;
        posts.push({
          id,
          title: input.title,
          content: input.content,
          voteScore: 0,
          createdAt: date,
          updatedAt: date,
          author: authorFor(author),
        });
        return { id };
      },
    } as unknown as PostRepository;
    const commentRepository = {
      findById: async (id: string) =>
        comments.find((comment) => comment.id === id) ?? null,
      findByPostId: async (postId: string) =>
        comments.filter((comment) => comment.postId === postId),
      create: async (input: {
        postId: string;
        authorMemberId: string;
        parentCommentId: string | null;
        content: string;
      }) => {
        const author = characterRecords.find(
          (character) =>
            memberByCharacter.get(character.id)?.id === input.authorMemberId,
        )!;
        const id = `generated-comment-${comments.length}`;
        comments.push({
          id,
          postId: input.postId,
          parentCommentId: input.parentCommentId,
          author: authorFor(author),
          content: input.content,
          voteScore: 0,
          createdAt: date,
          updatedAt: date,
          postTitle: posts.find((post) => post.id === input.postId)!.title,
        });
        return { id };
      },
    } as unknown as CommentRepository;
    const voteRepository = {
      findByMemberAndPost: async (memberId: string, postId: string) => {
        const value = votes.get(`${memberId}:${postId}`);
        return value === undefined
          ? null
          : { id: `vote-${memberId}-${postId}`, value };
      },
      setForPost: async (input: {
        postId: string;
        authorMemberId: string;
        value: 1 | -1 | null;
      }) => {
        const key = `${input.authorMemberId}:${input.postId}`;
        if (input.value === null) {
          votes.delete(key);
          return null;
        }
        votes.set(key, input.value);
        return { id: `vote-${key}` };
      },
    } as unknown as VoteRepository;
    const contextProvider = new SimulationContextProvider(
      worldRepository,
      characterRepository,
      memberRepository,
      postRepository,
      commentRepository,
    );
    const baseProvider = new MockLlmProvider(
      loadProviderConfig({
        LLM_PROVIDER: 'mock',
        LLM_MODEL: 'fixture-model',
        LLM_USAGE_METADATA: 'required',
      }),
      mockLlmFixtures,
    );
    const prompts: LlmProviderPrompt[] = [];
    const provider = new (class extends LlmProvider {
      readonly config = baseProvider.config;

      generateStructured<T>(
        request: LlmProviderRequest<T>,
      ): Promise<LlmProviderResult<T>> {
        prompts.push(request.prompt);
        return baseProvider.generateStructured(request);
      }
    })();
    const executor = new SimulationActionExecutor(
      new PostAction(contextProvider, provider),
      new VoteAction(contextProvider, provider, voteRepository),
      new CommentAction(contextProvider, provider),
    );
    const writer = new SimulationContentWriter(
      postRepository,
      commentRepository,
      voteRepository,
    );
    const logRepository = {
      create: async (
        input: Parameters<SimulationLogRepository['create']>[0],
      ) => {
        const record: SimulationLogRecord = {
          id: `log-${logs.length}`,
          worldId: input.worldId,
          characterId: input.characterId,
          action: input.action,
          targetId: input.targetId ?? null,
          reasoning: input.reasoning ?? null,
          provider: input.provider,
          model: input.model,
          latencyMs: input.latencyMs ?? null,
          jobId: input.jobId ?? null,
          executionSource: input.executionSource,
          tokensUsed: input.tokensUsed ?? null,
          costEstimate: input.costEstimate ?? null,
          status: input.status,
          errorMessage: input.errorMessage ?? null,
          executedAt: date,
        };
        logs.push(record);
        return record;
      },
    } as unknown as SimulationLogRepository;
    const logService = new SimulationLogService(
      logRepository,
      new SimulationCostEstimator(defaultSimulationCostConfig),
    );

    for (let index = 0; index < characterRecords.length; index += 1) {
      const character = characterRecords[index]!;
      for (const action of ['POST', 'VOTE', 'COMMENT'] as const) {
        const command =
          action === 'POST'
            ? { action, worldSlug: world.slug, characterId: character.id }
            : {
                action,
                worldSlug: world.slug,
                characterId: character.id,
                postId: 'seed-post',
              };
        const outcome = await executor.execute(command);
        expect(outcome.status).toBe('success');
        if (outcome.status !== 'success') continue;
        await writer.persist(outcome.decision);
        await logService.writeSuccess(
          outcome.decision,
          outcome.telemetry,
          'one-action',
        );
      }
    }

    expect(prompts).toHaveLength(48);
    expect(
      prompts.every((prompt) => prompt.user.includes(world.topicScope)),
    ).toBe(true);
    expect(
      prompts.every((prompt) => prompt.system.includes('Never reveal')),
    ).toBe(true);
    expect(posts).toHaveLength(17);
    expect(comments).toHaveLength(16);
    expect(votes.size).toBe(16);
    expect(logs).toHaveLength(48);
    expect(
      new Set(logs.map((log) => `${log.characterId}:${log.action}`)).size,
    ).toBe(48);
    expect(logs.every((log) => log.status === 'SUCCESS')).toBe(true);
    expect(logs.every((log) => (log.reasoning?.length ?? 0) > 0)).toBe(true);
    expect(
      characterRecords.every((character) => {
        const characterPrompts = prompts.filter((prompt) =>
          prompt.user.includes(`@${character.handle} (${character.name})`),
        );
        return (
          characterPrompts.length === 3 &&
          characterPrompts.every((prompt) =>
            prompt.user.includes(character.systemPrompt),
          )
        );
      }),
    ).toBe(true);
    expect(posts.slice(1).every((post) => !/<[^>]*>/u.test(post.content))).toBe(
      true,
    );
    expect(
      posts.slice(1).every((post) => post.content.includes('kitchen')),
    ).toBe(true);
    expect(comments.every((comment) => comment.postId === 'seed-post')).toBe(
      true,
    );
    expect(
      comments.every((comment) => /kitchen schedule/i.test(comment.content)),
    ).toBe(true);
  });
});
