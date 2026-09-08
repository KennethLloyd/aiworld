import { CursorPaginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListPostsResponse,
  PostResponse,
} from '@aiworld/shared/schemas/post-response.schema';

import { FeedPost, PostDetail, PostItem } from '@/posts/domain/post';
import {
  mapPaginatedPostResponse,
  mapPostDetailResponse,
  mapPostResponse,
} from '@/posts/mappers/post-response.mapper';

describe('post response mapper', () => {
  const postRecordFixture: PostItem = {
    id: '00000000-0000-4000-8000-000000000001',
    title: 'Who actually uses the microwave for FISH?',
    content: 'It smells like low tide.',
    voteScore: 5,
    createdAt: new Date('2026-08-06T08:00:00.000Z'),
    updatedAt: new Date('2026-08-06T08:00:00.000Z'),
  };

  const postResponseFixture: PostResponse = {
    ...postRecordFixture,
    createdAt: postRecordFixture.createdAt.toISOString(),
    updatedAt: postRecordFixture.updatedAt.toISOString(),
  };

  const authorFixture = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const feedPostRecordFixture: FeedPost = {
    ...postRecordFixture,
    author: authorFixture,
    commentCount: 2,
  };

  const feedPostResponseFixture = {
    ...postResponseFixture,
    author: authorFixture,
    commentCount: 2,
  };

  const paginatedPostRecords: CursorPaginated<FeedPost> = {
    items: [feedPostRecordFixture],
    nextCursor: null,
  };

  const paginatedPostResponse: ListPostsResponse = {
    items: [feedPostResponseFixture],
    nextCursor: null,
  };

  describe('mapToPostResponse', () => {
    it('converts dates to ISO strings and preserves the vote score', () => {
      expect(mapPostResponse(postRecordFixture)).toEqual(postResponseFixture);
    });

    it('keeps negative vote scores', () => {
      const downvoted: PostItem = {
        ...postRecordFixture,
        voteScore: -3,
      };

      expect(mapPostResponse(downvoted).voteScore).toBe(-3);
    });
  });

  describe('mapToPaginatedPostResponse', () => {
    it('maps every record with its author and comment count and preserves the pagination metadata', () => {
      expect(mapPaginatedPostResponse(paginatedPostRecords)).toEqual(
        paginatedPostResponse,
      );
    });
  });

  describe('mapToPostDetailResponse', () => {
    it('maps the author and the comment tree', () => {
      const detailRecord: PostDetail = {
        ...postRecordFixture,
        author: authorFixture,
        comments: [
          {
            id: '00000000-0000-4000-8000-000000000201',
            author: authorFixture,
            content: 'It was me. I said it.',
            voteScore: 2,
            createdAt: new Date('2026-08-06T09:00:00.000Z'),
            updatedAt: new Date('2026-08-06T09:00:00.000Z'),
            replies: [],
          },
        ],
      };

      expect(mapPostDetailResponse(detailRecord)).toEqual({
        ...postResponseFixture,
        author: detailRecord.author,
        comments: [
          {
            id: '00000000-0000-4000-8000-000000000201',
            author: authorFixture,
            content: 'It was me. I said it.',
            voteScore: 2,
            createdAt: '2026-08-06T09:00:00.000Z',
            updatedAt: '2026-08-06T09:00:00.000Z',
            replies: [],
          },
        ],
      });
    });

    it('maps an empty comment list without error', () => {
      const detailRecord = {
        ...postRecordFixture,
        author: authorFixture,
        comments: [],
      };

      expect(mapPostDetailResponse(detailRecord).comments).toEqual([]);
    });
  });
});
