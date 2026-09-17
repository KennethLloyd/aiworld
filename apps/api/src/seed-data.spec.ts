import { worldResponseSchema } from '@aiworld/shared/schemas/world-response.schema';

import {
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seededNarrative,
  seededVoteRows,
  seedUuid,
  validateCommentDepth,
} from '../prisma/seed-data';

describe('canonical Stillwater seed data', () => {
  it('round-trips the authored World through the shared response contract', () => {
    const response = worldResponseSchema.parse({
      id: seedUuid('world:stillwater'),
      ...canonicalWorld,
      residentCount: characters.length,
      createdAt: '2026-09-17T00:00:00.000Z',
      updatedAt: '2026-09-17T00:00:00.000Z',
    });

    expect(response.description).toEqual(canonicalWorld.description);
    expect(response.rules).toEqual(canonicalWorld.rules);
    expect(response.name).toBe('Stillwater');
    expect(response.slug).toBe('stillwater');
  });

  it('contains the five authored identity mappings', () => {
    expect(
      Object.fromEntries(
        characters.map((character) => [
          character.handle,
          [character.gender, character.pronouns],
        ]),
      ),
    ).toEqual({
      maraleads: ['female', 'she/her'],
      theodaily: ['male', 'he/him'],
      lenascorner: ['female', 'she/her'],
      adrianworks: ['male', 'he/him'],
      niconotes: ['male', 'he/him'],
    });
  });

  it('contains the approved eight-post ensemble opening', () => {
    expect(posts).toHaveLength(8);
    expect(posts.map((post) => post.authorKey)).toEqual([
      'niconotes',
      'adrianworks',
      'theodaily',
      'lenascorner',
      'maraleads',
      'niconotes',
      'adrianworks',
      'theodaily',
    ]);
    expect(seededNarrative.recentEvents).toContain('@maraleads');
    expect(seededNarrative.storySoFar).toContain('@adrianworks');
    expect(seededNarrative.continuitySummary).toContain('@niconotes');
  });

  it('rejects comment trees deeper than three levels', () => {
    expect(() =>
      validateCommentDepth([
        {
          key: 'level-1',
          authorKey: 'maraleads',
          content: 'one',
          offsetMinutes: 0,
          votes: [],
          replies: [
            {
              key: 'level-2',
              authorKey: 'theodaily',
              content: 'two',
              offsetMinutes: 1,
              votes: [],
              replies: [
                {
                  key: 'level-3',
                  authorKey: 'adrianworks',
                  content: 'three',
                  offsetMinutes: 2,
                  votes: [],
                  replies: [
                    {
                      key: 'level-4',
                      authorKey: 'niconotes',
                      content: 'four',
                      offsetMinutes: 3,
                      votes: [],
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

  it('keeps explicit votes distinct, bounded, and free of self-votes', () => {
    const byKey = new Map(
      characters.map((character) => [character.key, character]),
    );
    const targetAuthors = new Map<string, string>(
      posts.flatMap((post) => [
        [`post:${post.key}`, post.authorKey] as [string, string],
        ...flattenComments(post.comments).map(
          (comment) =>
            [`comment:${comment.key}`, comment.authorKey] as [string, string],
        ),
      ]),
    );

    for (const row of seededVoteRows()) {
      const targetKey = row.postKey
        ? `post:${row.postKey}`
        : `comment:${row.commentKey}`;
      expect(byKey.has(row.memberKey)).toBe(true);
      expect(targetAuthors.get(targetKey)).not.toBe(row.memberKey);
      expect(row.value === 1 || row.value === -1).toBe(true);
    }

    const voteKeys = seededVoteRows().map((row) => row.key);
    expect(new Set(voteKeys).size).toBe(voteKeys.length);
  });

  it('uses one relative timestamp scale spanning approximately seven days', () => {
    const offsets = [
      ...posts.map((post) => post.offsetMinutes),
      ...posts.flatMap((post) =>
        flattenComments(post.comments).map((comment) => comment.offsetMinutes),
      ),
    ];
    expect(Math.max(...offsets) - Math.min(...offsets)).toBeGreaterThanOrEqual(
      7 * 24 * 60 - 10,
    );
  });
});
