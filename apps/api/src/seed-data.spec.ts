import { worldResponseSchema } from '@aiworld/shared/schemas/world-response.schema';

import {
  buildSeedVotes,
  canonicalWorld,
  characters,
  flattenComments,
  posts,
  seedUuid,
  validateCommentDepth,
} from '../prisma/seed-data';

describe('canonical MBTI House seed data', () => {
  it('contains each MBTI type exactly once', () => {
    expect(characters).toHaveLength(16);
    expect(
      new Set(characters.map((character) => character.classification)).size,
    ).toBe(16);
    expect(new Set(characters.map((character) => character.key)).size).toBe(16);
  });

  it('contains varied seeded posts and threaded comments', () => {
    const comments = posts.flatMap((post) => flattenComments(post.comments));

    expect(posts).toHaveLength(8);
    expect(comments).toHaveLength(36);
    expect(comments.filter((comment) => comment.parentKey)).toHaveLength(5);
    expect(
      new Set(posts.map((post) => seedUuid(`post:${post.key}`))).size,
    ).toBe(posts.length);
  });

  it('round-trips the world description through the shared response contract', () => {
    const response = worldResponseSchema.parse({
      id: seedUuid('world:mbti-house'),
      ...canonicalWorld,
      residentCount: characters.length,
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

describe('seeded vote distribution', () => {
  const memberKeys = characters.map((character) => character.key);

  it('keeps every seeded total within the representable member count', () => {
    const totals = [
      ...posts,
      ...posts.flatMap((post) => flattenComments(post.comments)),
    ];

    for (const target of totals) {
      expect(target.upvotes).toBeGreaterThanOrEqual(0);
      expect(target.upvotes).toBeLessThanOrEqual(memberKeys.length);
    }
  });

  it('returns exactly one vote per upvote, all cast by distinct members', () => {
    const target = posts[0]!;
    const votes = buildSeedVotes(target, memberKeys);

    expect(votes).toHaveLength(target.upvotes);
    expect(new Set(votes.map((vote) => vote.memberKey)).size).toBe(
      votes.length,
    );

    for (const vote of votes) {
      expect(memberKeys).toContain(vote.memberKey);
      expect(vote.value).toBe(1);
    }
  });

  it('is deterministic for the same target and member list', () => {
    const target = posts[2]!;

    expect(buildSeedVotes(target, memberKeys)).toEqual(
      buildSeedVotes(target, memberKeys),
    );
  });

  it('varies the voter set across equal-sized targets', () => {
    const targets = posts.flatMap((post) => [
      post,
      ...flattenComments(post.comments),
    ]);
    const equalSized = targets.filter((target) => target.upvotes === 3);

    expect(equalSized.length).toBeGreaterThanOrEqual(2);

    const first = buildSeedVotes(equalSized[0]!, memberKeys).map(
      (vote) => vote.memberKey,
    );
    const second = buildSeedVotes(equalSized[1]!, memberKeys).map(
      (vote) => vote.memberKey,
    );

    expect(first).not.toEqual(second);
  });

  it('spreads votes so every member casts at least one seeded vote', () => {
    const voters = new Set(
      posts.flatMap((post) =>
        buildSeedVotes(post, memberKeys).map((vote) => vote.memberKey),
      ),
    );

    expect(voters.size).toBe(memberKeys.length);
  });
});
