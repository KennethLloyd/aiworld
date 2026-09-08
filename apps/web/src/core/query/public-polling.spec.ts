import { describe, expect, it } from 'vitest';

import {
  POLLING_OPTIONS,
  PUBLIC_FEED_POLL_INTERVAL_MS,
} from './public-polling';

describe('polling policy', () => {
  it('uses a feed cadence proportionate to simulation activity', () => {
    expect(PUBLIC_FEED_POLL_INTERVAL_MS).toBe(5 * 60_000);
  });

  it('pauses active polling in hidden tabs', () => {
    expect(POLLING_OPTIONS).toEqual({
      refetchIntervalInBackground: false,
    });
  });
});
