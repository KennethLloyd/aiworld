import { FlatCommentRecord } from '@/comments/domain/comment-record';
import {
  buildCommentTree,
  MAX_COMMENT_DEPTH,
} from '@/comments/domain/comment-tree';

function flatComment(
  id: string,
  parentCommentId: string | null,
  createdAt = '2026-08-06T09:00:00.000Z',
): FlatCommentRecord {
  return {
    id,
    postId: '00000000-0000-4000-8000-000000000001',
    parentCommentId,
    author: {
      id: '00000000-0000-4000-8000-000000000101',
      handle: 'standard_procedure',
      name: 'Standard_Procedure',
      avatarUrl: null,
    },
    content: `content-${id}`,
    voteScore: 1,
    createdAt: new Date(createdAt),
    updatedAt: new Date(createdAt),
  };
}

describe('buildCommentTree', () => {
  it('preserves parent-child relationships and orders siblings by createdAt', () => {
    const comments = [
      flatComment('c2', null, '2026-08-06T09:05:00.000Z'),
      flatComment('c2a', 'c2', '2026-08-06T09:10:00.000Z'),
      flatComment('c1', null, '2026-08-06T09:00:00.000Z'),
      flatComment('c2a1', 'c2a', '2026-08-06T09:15:00.000Z'),
      flatComment('c1a', 'c1', '2026-08-06T09:20:00.000Z'),
    ];

    const tree = buildCommentTree(comments);

    expect(tree.map((comment) => comment.id)).toEqual(['c1', 'c2']);
    expect(tree[0].replies.map((reply) => reply.id)).toEqual(['c1a']);
    expect(tree[1].replies.map((reply) => reply.id)).toEqual(['c2a']);
    expect(tree[1].replies[0].replies.map((reply) => reply.id)).toEqual([
      'c2a1',
    ]);
    expect(tree[1].replies[0].replies[0].replies).toEqual([]);
  });

  it('caps the tree at three levels of nesting without losing top-level comments', () => {
    const comments = [
      flatComment('c1', null),
      flatComment('c1a', 'c1'),
      flatComment('c1a1', 'c1a'),
      flatComment('c1a1a', 'c1a1'),
      flatComment('c1a1a1', 'c1a1a'),
    ];

    const tree = buildCommentTree(comments);

    expect(tree.map((comment) => comment.id)).toEqual(['c1']);
    expect(tree[0].replies.map((reply) => reply.id)).toEqual(['c1a']);
    expect(tree[0].replies[0].replies.map((reply) => reply.id)).toEqual([
      'c1a1',
    ]);
    expect(tree[0].replies[0].replies[0].replies).toEqual([]);
  });

  it('drops comments whose parent is not part of the loaded set', () => {
    const comments = [
      flatComment('c1', null),
      flatComment('orphan', 'missing-parent'),
    ];

    const tree = buildCommentTree(comments);

    expect(tree.map((comment) => comment.id)).toEqual(['c1']);
  });

  it('exposes the agreed read-side depth cap', () => {
    expect(MAX_COMMENT_DEPTH).toBe(3);
  });

  it('returns an empty tree for no comments', () => {
    expect(buildCommentTree([])).toEqual([]);
  });
});
