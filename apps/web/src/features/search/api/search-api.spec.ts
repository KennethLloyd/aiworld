import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { searchWorld } from './search-api';

describe('search API functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects malformed search responses at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(
            JSON.stringify({
              items: [{ type: 'comment', comment: { postId: 'bad' } }],
              meta: { page: 1, limit: 5, total: 1, totalPages: 1 },
            }),
            { status: 200 },
          ),
      ),
    );

    await expect(
      searchWorld('mbti', { q: 'quillfox', page: 1, limit: 5 }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
