import { describe, expect, it } from 'vitest';

import { POLLING_OPTIONS, PUBLIC_POLL_INTERVAL_MS } from './public-polling';

describe('polling policy', () => {
  it('uses a bounded public cadence and pauses hidden-tab polling', () => {
    expect(PUBLIC_POLL_INTERVAL_MS).toBe(30_000);
    expect(POLLING_OPTIONS).toEqual({
      refetchIntervalInBackground: false,
    });
  });
});
