import { CharactersService } from '@/characters/characters.service';
import { CommentsService } from '@/comments/comments.service';
import { PostsService } from '@/posts/posts.service';
import { WorldMembersService } from '@/world-members/world-members.service';
import { WorldService } from '@/world/world.service';

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
  author: { id: 'member-2', handle: 'other', name: 'Other', avatarUrl: null },
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
  const worldService = {
    getBySlug: jest
      .fn()
      .mockResolvedValue(
        overrides.world === undefined ? world : overrides.world,
      ),
  } as unknown as jest.Mocked<WorldService>;
  const charactersService = {
    getById: jest
      .fn()
      .mockResolvedValue(
        overrides.character === undefined ? character : overrides.character,
      ),
  } as unknown as jest.Mocked<CharactersService>;
  const worldMembersService = {
    findActiveByWorldAndCharacter: jest
      .fn()
      .mockResolvedValue(
        overrides.member === undefined ? { id: 'member-1' } : overrides.member,
      ),
  } as unknown as jest.Mocked<WorldMembersService>;
  const postsService = {
    findById: jest
      .fn()
      .mockResolvedValue(overrides.post === undefined ? post : overrides.post),
    findRecentByWorld: jest.fn().mockResolvedValue([]),
  } as unknown as jest.Mocked<PostsService>;
  const commentsService = {
    findByPostId: jest.fn().mockResolvedValue(overrides.thread ?? []),
  } as unknown as jest.Mocked<CommentsService>;

  return {
    provider: new SimulationContextProvider(
      worldService,
      charactersService,
      worldMembersService,
      postsService,
      commentsService,
    ),
    worldService,
    charactersService,
    worldMembersService,
    postsService,
    commentsService,
  };
}

describe('SimulationContextProvider', () => {
  it('resolves an active character through its active WorldMember', async () => {
    const { provider } = createProvider();

    await expect(
      provider.resolveActor('mbti-house', 'character-1'),
    ).resolves.toEqual({
      world,
      character,
      memberId: 'member-1',
    });
  });

  it('filters the membership lookup to active members', async () => {
    const { provider, worldMembersService } = createProvider();

    await provider.resolveActor('mbti-house', 'character-1');

    expect(
      worldMembersService.findActiveByWorldAndCharacter,
    ).toHaveBeenCalledWith('world-1', 'character-1');
  });

  it.each([
    ['character', { character: null }, 'CHARACTER_INACTIVE'],
    ['membership', { member: null }, 'MEMBER_NOT_FOUND'],
    ['World', { world: null }, 'WORLD_NOT_FOUND'],
  ] as const)(
    'rejects a missing or inactive %s',
    async (_label, overrides, code) => {
      const { provider } = createProvider(overrides);

      await expect(
        provider.resolveActor('mbti-house', 'character-1'),
      ).rejects.toMatchObject({
        code,
        retryable: false,
      });
    },
  );

  it('returns the post in the World', async () => {
    const { provider } = createProvider();

    await expect(provider.findPost('world-1', 'post-1')).resolves.toEqual(post);
  });

  it('rejects a post outside the World', async () => {
    const { provider } = createProvider({ post: null });

    await expect(provider.findPost('world-1', 'post-1')).rejects.toMatchObject({
      code: 'POST_NOT_FOUND',
      retryable: false,
    });
  });

  it('delegates bounded recent-post and thread reads to their services', async () => {
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
    const { provider, postsService, commentsService } = createProvider({
      thread: [comment],
    });
    postsService.findRecentByWorld.mockResolvedValue([post]);

    await expect(provider.findRecentPosts('world-1')).resolves.toEqual([post]);
    await expect(provider.findThread('post-1')).resolves.toEqual([comment]);
    expect(postsService.findRecentByWorld).toHaveBeenCalledWith('world-1', 5);
    expect(commentsService.findByPostId).toHaveBeenCalledWith('post-1');
  });
});
