import { Paginated } from '@aiworld/shared/schemas/pagination.schema';
import {
  ListPostsResponse,
  PostResponse,
} from '@aiworld/shared/schemas/post-response.schema';

import { PostRecord } from '@/posts/domain/post-record';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';

describe('PostResponseMapper', () => {
  const mapper = new PostResponseMapper();

  const postRecordFixture: PostRecord = {
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

  const paginatedPostRecords: Paginated<PostRecord> = {
    items: [postRecordFixture],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  const paginatedPostResponse: ListPostsResponse = {
    items: [postResponseFixture],
    meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
  };

  describe('mapToPostResponse', () => {
    it('converts dates to ISO strings and preserves the vote score', () => {
      expect(mapper.mapToPostResponse(postRecordFixture)).toEqual(
        postResponseFixture,
      );
    });

    it('keeps negative vote scores', () => {
      const downvoted: PostRecord = {
        ...postRecordFixture,
        voteScore: -3,
      };

      expect(mapper.mapToPostResponse(downvoted).voteScore).toBe(-3);
    });
  });

  describe('mapToPaginatedPostResponse', () => {
    it('maps every record and preserves the pagination metadata', () => {
      expect(mapper.mapToPaginatedPostResponse(paginatedPostRecords)).toEqual(
        paginatedPostResponse,
      );
    });
  });
});
