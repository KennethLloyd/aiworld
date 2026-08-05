import { describe, expect, it } from 'vitest';

import { worldKeys } from './world-keys';

describe('worldKeys', () => {
  it('centralizes the worlds root key', () => {
    expect(worldKeys.all).toEqual(['worlds']);
  });

  it('scopes list keys under all + list', () => {
    expect(worldKeys.lists()).toEqual(['worlds', 'list']);
    expect(worldKeys.list({ search: 'mbti', page: 1, limit: 20 })).toEqual([
      'worlds',
      'list',
      { search: 'mbti', page: 1, limit: 20 },
    ]);
  });

  it('keeps distinct list filters as distinct keys', () => {
    const pageOne = worldKeys.list({ search: 'mbti', page: 1, limit: 20 });
    const pageTwo = worldKeys.list({ search: 'mbti', page: 2, limit: 20 });
    const noSearch = worldKeys.list({ search: undefined, page: 1, limit: 20 });

    expect(pageTwo).not.toEqual(pageOne);
    expect(noSearch).not.toEqual(pageOne);
    // Key ordering is irrelevant to the query cache (stable hashing), but the
    // factory must produce the exact same shape for the same filters.
    expect(noSearch).toEqual(['worlds', 'list', { page: 1, limit: 20 }]);
  });

  it('scopes detail keys under all + detail with the slug', () => {
    expect(worldKeys.details()).toEqual(['worlds', 'detail']);
    expect(worldKeys.detail('mbti')).toEqual(['worlds', 'detail', 'mbti']);
    expect(worldKeys.detail('enneagram')).not.toEqual(worldKeys.detail('mbti'));
  });

  it('lets list invalidation match every list key but not detail keys', () => {
    const listKey = worldKeys.list({ search: '', page: 3, limit: 10 });
    const detailKey = worldKeys.detail('mbti');

    expect(listKey.slice(0, worldKeys.lists().length)).toEqual(
      worldKeys.lists(),
    );
    expect(detailKey.slice(0, worldKeys.lists().length)).not.toEqual(
      worldKeys.lists(),
    );
  });
});
