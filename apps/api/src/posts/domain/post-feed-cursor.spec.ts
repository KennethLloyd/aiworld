import type { PostFeedRecord } from '@/posts/domain/post-record';

import { encodePostFeedCursor, parsePostFeedCursor } from './post-feed-cursor';

const post: PostFeedRecord = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'A post',
  content: 'A body',
  voteScore: 7,
  createdAt: new Date('2026-08-25T10:00:00.000Z'),
  updatedAt: new Date('2026-08-25T10:00:00.000Z'),
  author: {
    id: '00000000-0000-4000-8000-000000000002',
    handle: 'counterpoint',
    name: 'counterpoint',
    avatarUrl: null,
  },
  commentCount: 3,
};

describe('post feed cursor', () => {
  it('round-trips the opaque cursor for its sort', () => {
    const raw = encodePostFeedCursor(post, 'hot');

    expect(parsePostFeedCursor(raw, 'hot')).toEqual({
      ok: true,
      cursor: {
        sort: 'hot',
        voteScore: 7,
        createdAt: post.createdAt,
        id: post.id,
      },
    });
  });

  it('starts at the first page when no cursor is supplied', () => {
    expect(parsePostFeedCursor(undefined, 'new')).toEqual({
      ok: true,
      cursor: null,
    });
  });

  it('rejects a cursor from another sort', () => {
    const raw = encodePostFeedCursor(post, 'hot');

    expect(parsePostFeedCursor(raw, 'new')).toEqual({ ok: false });
  });

  it('rejects malformed cursors', () => {
    expect(parsePostFeedCursor('not-a-cursor', 'new')).toEqual({ ok: false });
  });
});
