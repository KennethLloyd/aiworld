import { compareByHot } from '@/posts/domain/post-ranking';
import { PostRecord } from '@/posts/domain/post-record';

function post(
  overrides: Partial<PostRecord> & Pick<PostRecord, 'id' | 'createdAt'>,
): PostRecord {
  return {
    title: 'Title',
    content: 'Content',
    voteScore: 0,
    updatedAt: overrides.createdAt,
    ...overrides,
  };
}

describe('post ranking', () => {
  describe('compareByHot', () => {
    it('orders higher vote scores first', () => {
      const popular = post({
        id: 'a',
        createdAt: new Date('2026-08-05T00:00:00Z'),
        voteScore: 16,
      });
      const unpopular = post({
        id: 'b',
        createdAt: new Date('2026-08-06T00:00:00Z'),
        voteScore: 1,
      });

      expect(compareByHot(popular, unpopular)).toBeLessThan(0);
      expect(compareByHot(unpopular, popular)).toBeGreaterThan(0);
    });

    it('breaks score ties by recency', () => {
      const older = post({
        id: 'a',
        createdAt: new Date('2026-08-05T00:00:00Z'),
        voteScore: 5,
      });
      const newer = post({
        id: 'b',
        createdAt: new Date('2026-08-06T00:00:00Z'),
        voteScore: 5,
      });

      expect(compareByHot(newer, older)).toBeLessThan(0);
    });

    it('breaks score and recency ties deterministically by id', () => {
      const a = post({
        id: 'a',
        createdAt: new Date('2026-08-06T00:00:00Z'),
        voteScore: 5,
      });
      const b = post({
        id: 'b',
        createdAt: new Date('2026-08-06T00:00:00Z'),
        voteScore: 5,
      });

      expect(compareByHot(a, b)).toBeLessThan(0);
      expect(compareByHot(b, a)).toBeGreaterThan(0);
    });

    it('ranks a mixed list deterministically', () => {
      const posts = [
        post({
          id: 'b',
          createdAt: new Date('2026-08-06T05:00:00Z'),
          voteScore: 3,
        }),
        post({
          id: 'd',
          createdAt: new Date('2026-08-05T08:00:00Z'),
          voteScore: 1,
        }),
        post({
          id: 'a',
          createdAt: new Date('2026-08-06T08:00:00Z'),
          voteScore: 5,
        }),
        post({
          id: 'c',
          createdAt: new Date('2026-08-06T02:00:00Z'),
          voteScore: 16,
        }),
      ];

      expect([...posts].sort(compareByHot).map((item) => item.id)).toEqual([
        'c',
        'a',
        'b',
        'd',
      ]);
    });
  });
});
