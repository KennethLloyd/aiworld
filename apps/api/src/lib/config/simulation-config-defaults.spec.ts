import { createDefaultSimulationConfig } from '@/lib/config/simulation-config-defaults';

describe('createDefaultSimulationConfig', () => {
  it('returns the canonical lifecycle, pacing, weighting, and provider defaults', () => {
    expect(createDefaultSimulationConfig()).toEqual({
      state: 'PAUSED',
      speedMultiplier: 1,
      intervalMs: 1_800_000,
      jitterMs: 300_000,
      actionWeights: { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 },
      providerId: 'mock',
      model: 'mock',
    });
  });

  it('does not share mutable action weights between Worlds', () => {
    const first = createDefaultSimulationConfig();
    const second = createDefaultSimulationConfig();

    first.actionWeights.POST = 0.9;

    expect(second.actionWeights.POST).toBe(0.2);
  });
});
