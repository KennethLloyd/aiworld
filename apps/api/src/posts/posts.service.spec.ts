import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { BadRequestException } from '@nestjs/common';

import { CommentsService } from '@/comments/comments.service';
import { Author, Comment, FlatComment } from '@/comments/domain/comment';
import { PrismaService } from '@/lib/database/prisma.service';
import { FeedPost, PostItem } from '@/posts/domain/post';
import { WorldService, WorldView } from '@/world/world.service';

import { PostsService } from './posts.service';

describe('PostsService', () => {
  const world: WorldView = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: '16 personality types in a shared space' },
    rules: [],
    topicScope: 'MBTI theory and house life',
    residentCount: 16,
    isActive: true,
    createdAt: new Date('2026-08-01'),
    updatedAt: new Date('2026-08-01'),
  };
  const author: Author = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };
  const post: PostItem = {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };
  const flatComment: FlatComment = {
    id: '00000000-0000-4000-8000-000000000201',
    postId: post.id,
    parentCommentId: null,
    author,
    content: 'It was me. I said it.',
    voteScore: 2,
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
    postTitle: post.title,
  };
  const commentTree: Comment[] = [
    {
      id: flatComment.id,
      author,
      content: flatComment.content,
      voteScore: flatComment.voteScore,
      createdAt: flatComment.createdAt,
      updatedAt: flatComment.updatedAt,
      replies: [],
    },
  ];
  const feed: CursorPaginated<FeedPost> = {
    items: [{ ...post, author, commentCount: 2 }],
    nextCursor: null,
  };
  const query: ListPostsQuery = { sort: 'hot', limit: 20 };
  const worldService = {
    getBySlug: jest.fn(),
  } as unknown as jest.Mocked<Pick<WorldService, 'getBySlug'>>;
  const commentsService = {
    findByPostId: jest.fn(),
    countByPostIds: jest.fn(),
  } as unknown as jest.Mocked<
    Pick<CommentsService, 'findByPostId' | 'countByPostIds'>
  >;
  const prisma = {
    post: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  let service: PostsService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PostsService(
      worldService as unknown as WorldService,
      prisma as unknown as PrismaService,
      commentsService as unknown as CommentsService,
    );
    worldService.getBySlug.mockResolvedValue(world);
    commentsService.countByPostIds.mockResolvedValue(new Map([[post.id, 2]]));
  });

  it('resolves the active world and reads its feed directly from Prisma', async () => {
    prisma.post.findMany.mockResolvedValue([
      {
        ...post,
        author: {
          id: author.id,
          character: {
            handle: author.handle,
            name: author.name,
            avatarUrl: author.avatarUrl,
          },
          user: null,
        },
      },
    ]);

    await expect(service.findFeed('mbti-house', query)).resolves.toEqual(feed);
    expect(worldService.getBySlug).toHaveBeenCalledWith('mbti-house', false);
    expect(prisma.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ worldId: world.id }),
      }),
    );
  });

  it('rejects malformed cursors before querying Prisma', async () => {
    await expect(
      service.findFeed('mbti-house', { ...query, cursor: 'invalid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('returns null without querying posts when the world is missing', async () => {
    worldService.getBySlug.mockResolvedValue(null);

    await expect(service.findFeed('missing-world', query)).resolves.toBeNull();
    expect(prisma.post.findMany).not.toHaveBeenCalled();
  });

  it('returns a world-scoped post with its bounded comment tree', async () => {
    prisma.post.findFirst.mockResolvedValue({
      ...post,
      author: {
        id: author.id,
        character: {
          handle: author.handle,
          name: author.name,
          avatarUrl: author.avatarUrl,
        },
        user: null,
      },
    });
    commentsService.findByPostId.mockResolvedValue([flatComment]);

    await expect(
      service.findByWorldSlug('mbti-house', post.id),
    ).resolves.toEqual({
      ...post,
      author,
      comments: commentTree,
    });
    expect(prisma.post.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: post.id, worldId: world.id } }),
    );
    expect(commentsService.findByPostId).toHaveBeenCalledWith(post.id);
  });

  it('returns null when the world or post is missing', async () => {
    worldService.getBySlug.mockResolvedValue(null);
    await expect(
      service.findByWorldSlug('missing-world', post.id),
    ).resolves.toBeNull();

    worldService.getBySlug.mockResolvedValue(world);
    prisma.post.findFirst.mockResolvedValue(null);
    await expect(
      service.findByWorldSlug('mbti-house', 'missing-post'),
    ).resolves.toBeNull();
    expect(commentsService.findByPostId).not.toHaveBeenCalled();
  });
});
