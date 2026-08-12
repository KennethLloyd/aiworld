import { CharacterRepository } from '@/characters/repositories/character-repository.interface';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { WorldMemberRepository } from '@/world-members/repositories/world-member-repository.interface';
import { WorldRepository } from '@/world/repositories/world-repository.interface';

import { SimulationContextProvider } from './simulation-context-provider';

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

const post = {
  id: 'post-1',
  title: 'A thought',
  content: 'Body text.',
  voteScore: 0,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
  author: {
    id: 'member-2',
    handle: 'other',
    name: 'Other',
    avatarUrl: null,
  },
};

function createProvider(
  overrides: {
    world?: typeof world | null;
    character?: typeof character | null;
    member?: { id: string } | null;
    post?: typeof post | null;
    thread?: unknown[];
  } = {},
) {
  const worldRepository: jest.Mocked<WorldRepository> = {
    findAll: jest.fn(),
    findBySlug: jest
      .fn()
      .mockResolvedValue(
        overrides.world === undefined ? world : overrides.world,
      ),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const characterRepository: jest.Mocked<CharacterRepository> = {
    findAll: jest.fn(),
    findById: jest
      .fn()
      .mockResolvedValue(
        overrides.character === undefined ? character : overrides.character,
      ),
    findWorldSlugs: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const worldMemberRepository: jest.Mocked<WorldMemberRepository> = {
    findAll: jest.fn(),
    findById: jest.fn(),
    findByWorldAndCharacter: jest.fn(),
    findActiveByWorldAndCharacter: jest
      .fn()
      .mockResolvedValue(
        overrides.member === undefined ? { id: 'member-1' } : overrides.member,
      ),
    create: jest.fn(),
    update: jest.fn(),
  };
  const postRepository: jest.Mocked<PostRepository> = {
    findFeed: jest.fn(),
    findById: jest
      .fn()
      .mockResolvedValue(overrides.post === undefined ? post : overrides.post),
    findByAuthorMembership: jest.fn(),
    searchByText: jest.fn(),
    create: jest.fn(),
  };
  const commentRepository: jest.Mocked<CommentRepository> = {
    findById: jest.fn(),
    findByPostId: jest
      .fn()
      .mockResolvedValue(
        overrides.thread === undefined ? [] : overrides.thread,
      ),
    findByAuthorMembership: jest.fn(),
    searchByText: jest.fn(),
    countByPostIds: jest.fn(),
    create: jest.fn(),
  };

  const provider = new SimulationContextProvider(
    worldRepository,
    characterRepository,
    worldMemberRepository,
    postRepository,
    commentRepository,
  );

  return {
    provider,
    worldRepository,
    characterRepository,
    worldMemberRepository,
    postRepository,
    commentRepository,
  };
}

describe('SimulationContextProvider', () => {
  describe('resolveActor', () => {
    it('resolves an active character through its active WorldMember', async () => {
      const { provider } = createProvider();

      const actor = await provider.resolveActor('mbti-house', 'character-1');

      expect(actor).toEqual({
        world,
        character,
        memberId: 'member-1',
      });
    });

    it('filters the membership lookup to active members', async () => {
      const { provider, worldMemberRepository } = createProvider();

      await provider.resolveActor('mbti-house', 'character-1');

      expect(
        worldMemberRepository.findActiveByWorldAndCharacter,
      ).toHaveBeenCalledWith('world-1', 'character-1');
    });

    it('rejects an inactive character', async () => {
      const { provider } = createProvider({ character: null });

      await expect(
        provider.resolveActor('mbti-house', 'character-1'),
      ).rejects.toMatchObject({
        code: 'CHARACTER_INACTIVE',
        retryable: false,
      });
    });

    it('rejects a missing or inactive membership', async () => {
      const { provider } = createProvider({ member: null });

      await expect(
        provider.resolveActor('mbti-house', 'character-1'),
      ).rejects.toMatchObject({
        code: 'MEMBER_NOT_FOUND',
        retryable: false,
      });
    });

    it('rejects a missing or inactive World', async () => {
      const { provider } = createProvider({ world: null });

      await expect(
        provider.resolveActor('mbti-house', 'character-1'),
      ).rejects.toMatchObject({
        code: 'WORLD_NOT_FOUND',
        retryable: false,
      });
    });
  });

  describe('findPost', () => {
    it('returns the post in the World', async () => {
      const { provider } = createProvider();

      await expect(provider.findPost('world-1', 'post-1')).resolves.toEqual(
        post,
      );
    });

    it('rejects a post outside the World', async () => {
      const { provider } = createProvider({ post: null });

      await expect(
        provider.findPost('world-1', 'post-1'),
      ).rejects.toMatchObject({
        code: 'POST_NOT_FOUND',
        retryable: false,
      });
    });
  });

  describe('findThread', () => {
    it('delegates to the comment repository', async () => {
      const comment = {
        id: 'comment-1',
        postId: 'post-1',
        parentCommentId: null,
        author: {
          id: 'member-1',
          handle: 'standard_procedure',
          name: 'Standard_Procedure',
          avatarUrl: null,
        },
        content: 'Agreed.',
        voteScore: 0,
        createdAt: new Date('2026-01-02'),
        updatedAt: new Date('2026-01-02'),
        postTitle: 'A thought',
      };
      const { provider, commentRepository } = createProvider({
        thread: [comment],
      });

      const thread = await provider.findThread('post-1');

      expect(commentRepository.findByPostId).toHaveBeenCalledWith('post-1');
      expect(thread).toEqual([comment]);
    });
  });
});
