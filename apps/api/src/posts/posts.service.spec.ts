import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { ListPostsQuery } from '@aiworld/shared/schemas/post.schema';
import { Test, TestingModule } from '@nestjs/testing';

import {
  AuthorRecord,
  CommentRecord,
  FlatCommentRecord,
} from '@/comments/domain/comment-record';
import { CommentRepository } from '@/comments/repositories/comment-repository.interface';
import { PostRecord } from '@/posts/domain/post-record';
import { PostsService } from '@/posts/posts.service';
import { PostRepository } from '@/posts/repositories/post-repository.interface';
import { WorldRecord } from '@/world/domain/world-record';
import { WorldService } from '@/world/world.service';

describe('PostsService', () => {
  let service: PostsService;

  const worldRecordFixture: WorldRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: '16 personality types in a shared space' },
    rules: [],
    topicScope: 'MBTI theory and house life',
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const authorFixture: AuthorRecord = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const postRecordFixture: PostRecord = {
    id: '00000000-0000-4000-8000-000000000002',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };

  const flatCommentFixture: FlatCommentRecord = {
    id: '00000000-0000-4000-8000-000000000201',
    postId: postRecordFixture.id,
    parentCommentId: null,
    author: authorFixture,
    content: 'It was me. I said it.',
    voteScore: 2,
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
    postTitle: postRecordFixture.title,
  };

  const commentTreeFixture: CommentRecord[] = [
    {
      id: flatCommentFixture.id,
      author: authorFixture,
      content: flatCommentFixture.content,
      voteScore: flatCommentFixture.voteScore,
      createdAt: flatCommentFixture.createdAt,
      updatedAt: flatCommentFixture.updatedAt,
      replies: [],
    },
  ];

  const paginatedFeedFixture: Paginated<PostRecord> = {
    items: [postRecordFixture],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  const queryFixture: ListPostsQuery = { sort: 'hot', page: 1, limit: 20 };

  const mockWorldService: jest.Mocked<Pick<WorldService, 'getBySlug'>> = {
    getBySlug: jest.fn(),
  };

  const mockPostRepository: jest.Mocked<
    Pick<PostRepository, 'findFeed' | 'findById'>
  > = {
    findFeed: jest.fn(),
    findById: jest.fn(),
  };

  const mockCommentRepository: jest.Mocked<
    Pick<CommentRepository, 'findByPostId'>
  > = {
    findByPostId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PostsService,
        { provide: WorldService, useValue: mockWorldService },
        { provide: PostRepository, useValue: mockPostRepository },
        { provide: CommentRepository, useValue: mockCommentRepository },
      ],
    }).compile();

    service = module.get<PostsService>(PostsService);
    jest.clearAllMocks();
  });

  describe('findFeed', () => {
    it('resolves the active world and delegates with its id', async () => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
      mockPostRepository.findFeed.mockResolvedValue(paginatedFeedFixture);

      const feed = await service.findFeed('mbti-house', queryFixture);

      expect(feed).toEqual(paginatedFeedFixture);
      expect(mockWorldService.getBySlug).toHaveBeenCalledWith(
        'mbti-house',
        false,
      );
      expect(mockPostRepository.findFeed).toHaveBeenCalledWith(
        worldRecordFixture.id,
        queryFixture,
      );
    });

    it('returns null without querying posts when the world is missing', async () => {
      mockWorldService.getBySlug.mockResolvedValue(null);

      const feed = await service.findFeed('missing-world', queryFixture);

      expect(feed).toBeNull();
      expect(mockPostRepository.findFeed).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('returns the post with its bounded comment tree', async () => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
      mockPostRepository.findById.mockResolvedValue({
        ...postRecordFixture,
        author: authorFixture,
      });
      mockCommentRepository.findByPostId.mockResolvedValue([
        flatCommentFixture,
      ]);

      const detail = await service.findById('mbti-house', postRecordFixture.id);

      expect(detail).toEqual({
        ...postRecordFixture,
        author: authorFixture,
        comments: commentTreeFixture,
      });
      expect(mockPostRepository.findById).toHaveBeenCalledWith(
        worldRecordFixture.id,
        postRecordFixture.id,
      );
      expect(mockCommentRepository.findByPostId).toHaveBeenCalledWith(
        postRecordFixture.id,
      );
    });

    it('returns null without querying comments when the world is missing', async () => {
      mockWorldService.getBySlug.mockResolvedValue(null);

      const detail = await service.findById('missing-world', 'some-post');

      expect(detail).toBeNull();
      expect(mockPostRepository.findById).not.toHaveBeenCalled();
      expect(mockCommentRepository.findByPostId).not.toHaveBeenCalled();
    });

    it('returns null without querying comments when the post is not in that world', async () => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
      mockPostRepository.findById.mockResolvedValue(null);

      const detail = await service.findById(
        'mbti-house',
        '00000000-0000-4000-8000-00000000dead',
      );

      expect(detail).toBeNull();
      expect(mockCommentRepository.findByPostId).not.toHaveBeenCalled();
    });
  });
});
