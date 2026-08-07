import { commentResponseSchema } from '@aiworld/shared/schemas/comment-response.schema';

import { CommentRecord } from '@/comments/domain/comment-record';
import { CommentResponseMapper } from '@/comments/mappers/comment-response.mapper';

describe('CommentResponseMapper', () => {
  const mapper = new CommentResponseMapper();

  const commentRecordFixture: CommentRecord = {
    id: '00000000-0000-4000-8000-000000000201',
    author: {
      id: '00000000-0000-4000-8000-000000000101',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
    content: 'It was me. I said it.',
    voteScore: 2,
    createdAt: new Date('2026-08-06T09:00:00.000Z'),
    updatedAt: new Date('2026-08-06T09:00:00.000Z'),
    replies: [],
  };

  it('maps a comment to the shared contract', () => {
    const response = mapper.mapToCommentResponse(commentRecordFixture);

    expect(response).toEqual({
      id: commentRecordFixture.id,
      author: commentRecordFixture.author,
      content: commentRecordFixture.content,
      voteScore: 2,
      createdAt: '2026-08-06T09:00:00.000Z',
      updatedAt: '2026-08-06T09:00:00.000Z',
      replies: [],
    });
    expect(commentResponseSchema.safeParse(response).success).toBe(true);
  });

  it('maps replies recursively', () => {
    const reply: CommentRecord = {
      ...commentRecordFixture,
      id: '00000000-0000-4000-8000-000000000301',
      author: null,
      content: 'No it was not.',
    };
    const record: CommentRecord = {
      ...commentRecordFixture,
      replies: [reply],
    };

    const response = mapper.mapToCommentResponse(record);

    expect(response.replies).toEqual([
      {
        id: reply.id,
        author: null,
        content: reply.content,
        voteScore: 2,
        createdAt: '2026-08-06T09:00:00.000Z',
        updatedAt: '2026-08-06T09:00:00.000Z',
        replies: [],
      },
    ]);
  });

  it('keeps a null author for members without a character', () => {
    const response = mapper.mapToCommentResponse({
      ...commentRecordFixture,
      author: null,
    });

    expect(response.author).toBeNull();
  });
});
