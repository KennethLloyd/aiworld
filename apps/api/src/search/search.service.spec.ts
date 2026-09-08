import { SearchQuery } from '@aiworld/shared/schemas/search.schema';
import { Test, TestingModule } from '@nestjs/testing';

import { CommentsService } from '@/comments/comments.service';
import { Author, FlatComment } from '@/comments/domain/comment';
import { PostWithAuthor } from '@/posts/domain/post';
import { PostsService } from '@/posts/posts.service';
import { SearchResult } from '@/search/domain/search';
import { SearchService } from '@/search/search.service';
import { WorldService, WorldView } from '@/world/world.service';

describe('SearchService', () => {
  let service: SearchService;

  const worldRecordFixture: WorldView = {
    id: '00000000-0000-4000-8000-000000000001',
    name: 'The MBTI House',
    slug: 'mbti-house',
    description: { about: '16 personality types in a shared space' },
    rules: [],
    topicScope: 'MBTI theory and house life',
    residentCount: 16,
    isActive: true,
    createdAt: new Date('2026-08-01T00:00:00.000Z'),
    updatedAt: new Date('2026-08-01T00:00:00.000Z'),
  };

  const authorFixture: Author = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const postAt = (id: string, createdAt: string): PostWithAuthor => ({
    id,
    title: 'Title matches the query',
    content: 'Body matches the query',
    voteScore: 5,
    author: authorFixture,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  });

  const commentAt = (id: string, createdAt: string): FlatComment => ({
    id,
    postId: '00000000-0000-4000-8000-000000000002',
    parentCommentId: null,
    postTitle: 'A fixture post',
    author: authorFixture,
    content: 'Comment matches the query',
    voteScore: 2,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  });

  const queryFixture: SearchQuery = { q: 'quillfox', page: 1, limit: 20 };

  const mockWorldService: jest.Mocked<Pick<WorldService, 'getBySlug'>> = {
    getBySlug: jest.fn(),
  };

  const mockPostsService: jest.Mocked<Pick<PostsService, 'searchByText'>> = {
    searchByText: jest.fn(),
  };

  const mockCommentsService: jest.Mocked<
    Pick<CommentsService, 'searchByText'>
  > = {
    searchByText: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: WorldService, useValue: mockWorldService },
        { provide: PostsService, useValue: mockPostsService },
        { provide: CommentsService, useValue: mockCommentsService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);
    jest.clearAllMocks();
  });

  it('returns null without querying repositories when the world is missing', async () => {
    mockWorldService.getBySlug.mockResolvedValue(null);

    const results = await service.search('missing-world', queryFixture);

    expect(results).toBeNull();
    expect(mockPostsService.searchByText).not.toHaveBeenCalled();
    expect(mockCommentsService.searchByText).not.toHaveBeenCalled();
  });

  it('resolves the active world and queries both repositories with its id', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockPostsService.searchByText.mockResolvedValue([]);
    mockCommentsService.searchByText.mockResolvedValue([]);

    const results = await service.search('mbti-house', queryFixture);

    expect(mockWorldService.getBySlug).toHaveBeenCalledWith(
      'mbti-house',
      false,
    );
    expect(mockPostsService.searchByText).toHaveBeenCalledWith(
      worldRecordFixture.id,
      'quillfox',
    );
    expect(mockCommentsService.searchByText).toHaveBeenCalledWith(
      worldRecordFixture.id,
      'quillfox',
    );
    expect(results).toEqual({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
  });

  it.each([
    { label: 'absent q', query: { page: 1, limit: 20 } },
    { label: 'empty q', query: { q: '', page: 1, limit: 20 } },
    { label: 'whitespace q', query: { q: '   ', page: 1, limit: 20 } },
  ])(
    'returns an empty page with zero metadata for $label',
    async ({ query }) => {
      mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);

      const results = await service.search('mbti-house', query);

      expect(results).toEqual({
        items: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });
      expect(mockPostsService.searchByText).not.toHaveBeenCalled();
      expect(mockCommentsService.searchByText).not.toHaveBeenCalled();
    },
  );

  it('returns an empty page with zero metadata for a one-character q', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);

    const results = await service.search('mbti-house', {
      q: 'a',
      page: 1,
      limit: 20,
    });

    expect(results).toEqual({
      items: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });
    expect(mockPostsService.searchByText).not.toHaveBeenCalled();
    expect(mockCommentsService.searchByText).not.toHaveBeenCalled();
  });

  it('trims surrounding whitespace from q before matching', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockPostsService.searchByText.mockResolvedValue([]);
    mockCommentsService.searchByText.mockResolvedValue([]);

    await service.search('mbti-house', {
      q: '  quillfox  ',
      page: 1,
      limit: 20,
    });

    expect(mockPostsService.searchByText).toHaveBeenCalledWith(
      worldRecordFixture.id,
      'quillfox',
    );
  });

  it('merges posts and comments deterministically by createdAt desc then id desc', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockPostsService.searchByText.mockResolvedValue([
      postAt(
        '00000000-0000-4000-8000-000000000003',
        '2026-08-06T10:00:00.000Z',
      ),
      postAt(
        '00000000-0000-4000-8000-000000000004',
        '2026-08-06T08:00:00.000Z',
      ),
    ]);
    mockCommentsService.searchByText.mockResolvedValue([
      commentAt(
        '00000000-0000-4000-8000-000000000001',
        '2026-08-06T11:00:00.000Z',
      ),
      commentAt(
        '00000000-0000-4000-8000-000000000002',
        '2026-08-06T10:00:00.000Z',
      ),
    ]);

    const results = await service.search('mbti-house', queryFixture);

    // 11:00 comment first, then the two 10:00 records by id desc,
    // then the 08:00 post.
    const ids = results!.items.map((item) =>
      item.type === 'post' ? item.post.id : item.comment.id,
    );
    expect(ids).toEqual([
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000003',
      '00000000-0000-4000-8000-000000000002',
      '00000000-0000-4000-8000-000000000004',
    ]);
  });

  it('tags each merged record with its type', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockPostsService.searchByText.mockResolvedValue([
      postAt(
        '00000000-0000-4000-8000-000000000001',
        '2026-08-06T10:00:00.000Z',
      ),
    ]);
    mockCommentsService.searchByText.mockResolvedValue([
      commentAt(
        '00000000-0000-4000-8000-000000000002',
        '2026-08-06T11:00:00.000Z',
      ),
    ]);

    const results = (await service.search('mbti-house', queryFixture))!;
    const records = results.items as SearchResult[];

    expect(records[0]).toEqual({
      type: 'comment',
      comment: expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000002',
      }),
    });
    expect(records[1]).toEqual({
      type: 'post',
      post: expect.objectContaining({
        id: '00000000-0000-4000-8000-000000000001',
      }),
    });
  });

  it('computes pagination metadata from the full merged result set', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockPostsService.searchByText.mockResolvedValue([
      postAt(
        '00000000-0000-4000-8000-000000000001',
        '2026-08-06T10:00:00.000Z',
      ),
      postAt(
        '00000000-0000-4000-8000-000000000002',
        '2026-08-06T09:00:00.000Z',
      ),
    ]);
    mockCommentsService.searchByText.mockResolvedValue([
      commentAt(
        '00000000-0000-4000-8000-000000000003',
        '2026-08-06T11:00:00.000Z',
      ),
    ]);

    const results = await service.search('mbti-house', {
      q: 'quillfox',
      page: 1,
      limit: 2,
    });

    expect(results!.items).toHaveLength(2);
    expect(results!.meta).toEqual({
      page: 1,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });

  it('slices the merged list by page and keeps metadata stable beyond the last page', async () => {
    mockWorldService.getBySlug.mockResolvedValue(worldRecordFixture);
    mockPostsService.searchByText.mockResolvedValue([
      postAt(
        '00000000-0000-4000-8000-000000000001',
        '2026-08-06T10:00:00.000Z',
      ),
      postAt(
        '00000000-0000-4000-8000-000000000002',
        '2026-08-06T09:00:00.000Z',
      ),
    ]);
    mockCommentsService.searchByText.mockResolvedValue([
      commentAt(
        '00000000-0000-4000-8000-000000000003',
        '2026-08-06T11:00:00.000Z',
      ),
    ]);

    const pageTwo = await service.search('mbti-house', {
      q: 'quillfox',
      page: 2,
      limit: 2,
    });

    const pageTwoIds = pageTwo!.items.map((item) =>
      item.type === 'post' ? item.post.id : item.comment.id,
    );
    expect(pageTwoIds).toEqual(['00000000-0000-4000-8000-000000000002']);
    expect(pageTwo!.meta).toEqual({
      page: 2,
      limit: 2,
      total: 3,
      totalPages: 2,
    });

    const pageNine = await service.search('mbti-house', {
      q: 'quillfox',
      page: 9,
      limit: 2,
    });

    expect(pageNine!.items).toEqual([]);
    expect(pageNine!.meta).toEqual({
      page: 9,
      limit: 2,
      total: 3,
      totalPages: 2,
    });
  });
});
