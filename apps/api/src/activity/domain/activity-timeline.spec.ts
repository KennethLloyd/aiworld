import {
  compareActivityOrder,
  mergeActivityItems,
} from '@/activity/domain/activity-timeline';
import { FlatCommentRecord } from '@/comments/domain/comment-record';
import { PostWithAuthorRecord } from '@/posts/domain/post-record';

describe('activity timeline', () => {
  const post = (id: string, iso: string): PostWithAuthorRecord => ({
    id,
    title: 'A post',
    content: 'Post content.',
    voteScore: 1,
    createdAt: new Date(iso),
    updatedAt: new Date(iso),
    author: {
      id: '00000000-0000-4000-8000-000000000101',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
  });

  const comment = (id: string, iso: string): FlatCommentRecord => ({
    id,
    postId: '00000000-0000-4000-8000-000000000301',
    parentCommentId: null,
    author: {
      id: '00000000-0000-4000-8000-000000000101',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
    content: 'A comment.',
    voteScore: 1,
    createdAt: new Date(iso),
    updatedAt: new Date(iso),
    postTitle: 'A post',
  });

  it('interleaves the streams by createdAt desc', () => {
    const merged = mergeActivityItems(
      // Repositories return each stream ordered createdAt DESC, id DESC.
      [
        post('p-late', '2026-08-06T08:30:00.000Z'),
        post('p-early', '2026-08-06T08:00:00.000Z'),
      ],
      [comment('c-mid', '2026-08-06T08:15:00.000Z')],
    );

    expect(merged.map((item) => item.record.id)).toEqual([
      'p-late',
      'c-mid',
      'p-early',
    ]);
  });

  it('breaks createdAt ties by id desc', () => {
    const merged = mergeActivityItems(
      [post('post-aaa', '2026-08-06T08:00:00.000Z')],
      [comment('comment-zzz', '2026-08-06T08:00:00.000Z')],
    );

    expect(merged.map((item) => item.record.id)).toEqual([
      'post-aaa',
      'comment-zzz',
    ]);
  });

  it('keeps a one-sided stream intact', () => {
    const merged = mergeActivityItems(
      [
        post('p-2', '2026-08-06T08:10:00.000Z'),
        post('p-1', '2026-08-06T08:00:00.000Z'),
      ],
      [],
    );

    expect(merged.map((item) => item.record.id)).toEqual(['p-2', 'p-1']);
  });

  it('orders two positions deterministically', () => {
    const earlier = {
      createdAt: new Date('2026-08-06T08:00:00.000Z'),
      id: 'a',
    };
    const later = { createdAt: new Date('2026-08-06T08:10:00.000Z'), id: 'a' };

    expect(compareActivityOrder(earlier, later)).toBeGreaterThan(0);
    expect(compareActivityOrder(later, earlier)).toBeLessThan(0);
    expect(
      compareActivityOrder(earlier, { ...earlier, id: 'b' }),
    ).toBeGreaterThan(0);
  });
});
