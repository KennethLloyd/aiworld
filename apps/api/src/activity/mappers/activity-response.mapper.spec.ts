import { CharacterActivityPageRecord } from '@/activity/domain/activity-record';
import { ActivityResponseMapper } from '@/activity/mappers/activity-response.mapper';
import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';
import { PostResponseMapper } from '@/posts/mappers/post-response.mapper';

describe('ActivityResponseMapper', () => {
  const commentResponseMapper = new CommentResponseMapper();
  const mapper = new ActivityResponseMapper(
    new PostResponseMapper(commentResponseMapper),
    commentResponseMapper,
  );

  const authorFixture = {
    id: '00000000-0000-4000-8000-000000000101',
    handle: 'standard_procedure',
    name: 'Standard_Procedure',
    avatarUrl: null,
  };

  const pageRecordFixture: CharacterActivityPageRecord = {
    items: [
      {
        kind: 'post',
        record: {
          id: '00000000-0000-4000-8000-000000000001',
          title: 'Who actually uses the microwave for FISH?',
          content: 'It smells like low tide.',
          voteScore: 5,
          createdAt: new Date('2026-08-06T08:00:00.000Z'),
          updatedAt: new Date('2026-08-06T08:00:00.000Z'),
          author: authorFixture,
        },
      },
      {
        kind: 'comment',
        record: {
          id: '00000000-0000-4000-8000-000000000201',
          postId: '00000000-0000-4000-8000-000000000001',
          parentCommentId: null,
          author: authorFixture,
          content: 'It was me. I said it.',
          voteScore: 2,
          createdAt: new Date('2026-08-06T09:00:00.000Z'),
          updatedAt: new Date('2026-08-06T09:00:00.000Z'),
          postTitle: 'Who actually uses the microwave for FISH?',
        },
      },
    ],
    nextCursor: 'opaque-cursor-value',
  };

  it('maps merged items with their kind and the cursor', () => {
    const response = mapper.mapToCharacterActivityResponse(pageRecordFixture);

    expect(response).toEqual({
      items: [
        {
          kind: 'post',
          id: pageRecordFixture.items[0].record.id,
          title: 'Who actually uses the microwave for FISH?',
          content: 'It smells like low tide.',
          voteScore: 5,
          createdAt: '2026-08-06T08:00:00.000Z',
          updatedAt: '2026-08-06T08:00:00.000Z',
          author: authorFixture,
        },
        {
          kind: 'comment',
          id: pageRecordFixture.items[1].record.id,
          author: authorFixture,
          content: 'It was me. I said it.',
          voteScore: 2,
          createdAt: '2026-08-06T09:00:00.000Z',
          updatedAt: '2026-08-06T09:00:00.000Z',
          replies: [],
          postTitle: 'Who actually uses the microwave for FISH?',
        },
      ],
      nextCursor: 'opaque-cursor-value',
    });
  });

  it('maps the member-based author through the response unchanged', () => {
    const memberAuthor = {
      id: '00000000-0000-4000-8000-000000000222',
      handle: 'another_member',
      name: 'Another Member',
      avatarUrl: null,
    };

    const response = mapper.mapToCharacterActivityResponse({
      items: [
        {
          kind: 'comment',
          record: {
            id: '00000000-0000-4000-8000-000000000201',
            postId: '00000000-0000-4000-8000-000000000001',
            parentCommentId: null,
            author: memberAuthor,
            content: 'It was me. I said it.',
            voteScore: 2,
            createdAt: new Date('2026-08-06T09:00:00.000Z'),
            updatedAt: new Date('2026-08-06T09:00:00.000Z'),
            postTitle: 'Who actually uses the microwave for FISH?',
          },
        },
      ],
      nextCursor: null,
    });

    expect(response.items[0]).toMatchObject({ author: memberAuthor });
  });

  it('passes the nextCursor through untouched', () => {
    const response = mapper.mapToCharacterActivityResponse({
      items: [],
      nextCursor: 'another-cursor',
    });

    expect(response.nextCursor).toBe('another-cursor');
  });
});
