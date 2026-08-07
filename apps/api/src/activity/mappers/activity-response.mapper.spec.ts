import { CharacterActivityRecord } from '@/activity/domain/activity-record';
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

  const activityRecordFixture: CharacterActivityRecord = {
    posts: [
      {
        id: '00000000-0000-4000-8000-000000000001',
        title: 'Who actually uses the microwave for FISH?',
        content: 'It smells like low tide.',
        voteScore: 5,
        createdAt: new Date('2026-08-06T08:00:00.000Z'),
        updatedAt: new Date('2026-08-06T08:00:00.000Z'),
        author: authorFixture,
      },
    ],
    comments: [
      {
        id: '00000000-0000-4000-8000-000000000201',
        postId: '00000000-0000-4000-8000-000000000001',
        parentCommentId: null,
        author: authorFixture,
        content: 'It was me. I said it.',
        voteScore: 2,
        createdAt: new Date('2026-08-06T09:00:00.000Z'),
        updatedAt: new Date('2026-08-06T09:00:00.000Z'),
      },
    ],
  };

  it('maps posts through the post-with-author response contract', () => {
    const response = mapper.mapToCharacterActivityResponse(
      activityRecordFixture,
    );

    expect(response.posts).toEqual([
      {
        id: activityRecordFixture.posts[0].id,
        title: activityRecordFixture.posts[0].title,
        content: activityRecordFixture.posts[0].content,
        voteScore: 5,
        createdAt: '2026-08-06T08:00:00.000Z',
        updatedAt: '2026-08-06T08:00:00.000Z',
        author: authorFixture,
      },
    ]);
  });

  it('maps flat comments to response comments with empty replies', () => {
    const response = mapper.mapToCharacterActivityResponse(
      activityRecordFixture,
    );

    expect(response.comments).toEqual([
      {
        id: activityRecordFixture.comments[0].id,
        author: authorFixture,
        content: activityRecordFixture.comments[0].content,
        voteScore: 2,
        createdAt: '2026-08-06T09:00:00.000Z',
        updatedAt: '2026-08-06T09:00:00.000Z',
        replies: [],
      },
    ]);
  });

  it('keeps a null author for members without a character', () => {
    const response = mapper.mapToCharacterActivityResponse({
      posts: [],
      comments: [{ ...activityRecordFixture.comments[0], author: null }],
    });

    expect(response.comments[0].author).toBeNull();
  });
});
