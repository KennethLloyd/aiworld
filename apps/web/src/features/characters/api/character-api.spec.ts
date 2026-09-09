import { afterEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';

import { getCharacterActivity } from './character-api';

const characterId = '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12';

describe('character API functions', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects malformed public activity payloads at the API boundary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        async () =>
          new Response(JSON.stringify({ items: [{ kind: 'unknown' }] }), {
            status: 200,
          }),
      ),
    );

    await expect(
      getCharacterActivity(characterId, { worldSlug: 'mbti', limit: 20 }),
    ).rejects.toBeInstanceOf(ZodError);
  });
});
