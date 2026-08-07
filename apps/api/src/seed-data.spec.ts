import { worldResponseSchema } from '@aiworld/shared/schemas/world-response.schema';

import {
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seedUuid,
  validateCommentDepth,
} from '../prisma/seed-data';

describe('canonical MBTI House seed data', () => {
  it('contains each MBTI type exactly once', () => {
    const types = characters.map((character) => character.classification);

    expect(characters).toHaveLength(16);
    expect(new Set(types).size).toBe(16);
  });

  it('contains the prototype posts and threaded comments', () => {
    const comments = posts.flatMap((post) => flattenComments(post.comments));

    expect(posts).toHaveLength(4);
    expect(comments).toHaveLength(14);
    expect(comments.filter((comment) => comment.parentKey)).toHaveLength(1);
    expect(
      new Set(posts.map((post) => seedUuid(`post:${post.key}`))).size,
    ).toBe(4);
  });

  it('round-trips the world description through the shared response contract', () => {
    const response = worldResponseSchema.parse({
      id: seedUuid('world:mbti-house'),
      ...canonicalWorld,
      createdAt: '2026-08-06T00:00:00.000Z',
      updatedAt: '2026-08-06T00:00:00.000Z',
    });

    expect(response.description).toEqual(canonicalWorld.description);
    expect(response.rules).toEqual(canonicalWorld.rules);
  });

  it('rejects comment trees deeper than three levels', () => {
    expect(() =>
      validateCommentDepth([
        {
          key: 'level-1',
          authorKey: 'standard_procedure',
          content: 'one',
          upvotes: 0,
          createdAt: '2026-08-06T00:00:00.000Z',
          replies: [
            {
              key: 'level-2',
              authorKey: 'steady_hands',
              content: 'two',
              upvotes: 0,
              createdAt: '2026-08-06T00:00:00.000Z',
              replies: [
                {
                  key: 'level-3',
                  authorKey: 'boss_mode',
                  content: 'three',
                  upvotes: 0,
                  createdAt: '2026-08-06T00:00:00.000Z',
                  replies: [
                    {
                      key: 'level-4',
                      authorKey: 'baking_cookies',
                      content: 'four',
                      upvotes: 0,
                      createdAt: '2026-08-06T00:00:00.000Z',
                    },
                  ],
                },
              ],
            },
          ],
        },
      ]),
    ).toThrow('cannot exceed three levels');
  });
});
