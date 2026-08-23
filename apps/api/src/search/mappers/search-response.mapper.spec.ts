import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import { Test, TestingModule } from '@nestjs/testing';

import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';
import { SearchResultRecord } from '@/search/domain/search-record';
import { SearchResponseMapper } from '@/search/mappers/search-response.mapper';

describe('SearchResponseMapper', () => {
  let mapper: SearchResponseMapper;

  const postRecordFixture: PostWithAuthorRecord = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'The quillfox manifesto',
    content: 'Bamboo wisdom.',
    voteScore: 5,
    author: {
      id: '00000000-0000-4000-8000-000000000101',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };

  const commentRecordFixture: FlatCommentRecord = {
    id: '00000000-0000-4000-8000-000000000002',
    postId: postRecordFixture.id,
    parentCommentId: null,
    postTitle: 'A fixture post',
    author: postRecordFixture.author,
    content: 'Never trust a quillfox.',
    voteScore: 2,
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchResponseMapper,
        PostResponseMapper,
        CommentResponseMapper,
      ],
    }).compile();

    mapper = module.get<SearchResponseMapper>(SearchResponseMapper);
  });

  it('maps posts with the post type tag', () => {
    const records: Paginated<SearchResultRecord> = {
      items: [{ type: 'post', post: postRecordFixture }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    expect(mapper.mapToSearchResponse(records)).toEqual({
      items: [
        {
          type: 'post',
          post: {
            id: postRecordFixture.id,
            title: postRecordFixture.title,
            content: postRecordFixture.content,
            voteScore: postRecordFixture.voteScore,
            author: postRecordFixture.author,
            createdAt: '2026-08-06T08:00:00.000Z',
            updatedAt: '2026-08-06T08:00:00.000Z',
          },
        },
      ],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });
  });

  it('maps comments with the comment type tag and an empty replies list', () => {
    const records: Paginated<SearchResultRecord> = {
      items: [{ type: 'comment', comment: commentRecordFixture }],
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    };

    const response = mapper.mapToSearchResponse(records);

    expect(response.items).toEqual([
      {
        type: 'comment',
        comment: {
          id: commentRecordFixture.id,
          postId: commentRecordFixture.postId,
          author: commentRecordFixture.author,
          content: commentRecordFixture.content,
          voteScore: commentRecordFixture.voteScore,
          postTitle: commentRecordFixture.postTitle,
          createdAt: '2026-08-06T09:00:00.000Z',
          updatedAt: '2026-08-06T09:00:00.000Z',
          replies: [],
        },
      },
    ]);
  });

  it('maps a mixed list preserving order and the shared meta', () => {
    const records: Paginated<SearchResultRecord> = {
      items: [
        { type: 'comment', comment: commentRecordFixture },
        { type: 'post', post: postRecordFixture },
      ],
      meta: { page: 2, limit: 5, total: 2, totalPages: 1 },
    };

    const response = mapper.mapToSearchResponse(records);

    expect(response.items.map((item) => item.type)).toEqual([
      'comment',
      'post',
    ]);
    expect(response.meta).toEqual({
      page: 2,
      limit: 5,
      total: 2,
      totalPages: 1,
    });
  });
});
