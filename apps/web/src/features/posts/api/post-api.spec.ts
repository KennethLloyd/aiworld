import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { getPostById } from './post-api';

describe('post API functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects malformed public payloads at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ id: 'not-a-uuid' }), { status: 200 }),
      ),
    );

    await expect(
      getPostById('mbti', '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11'),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
