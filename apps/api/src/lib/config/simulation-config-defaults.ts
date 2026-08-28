export type SimulationActionWeights = {
  POST: number;
  VOTE: number;
  COMMENT: number;
};

export type SimulationConfigDefaults = {
  state: 'PAUSED';
  speedMultiplier: number;
  intervalMs: number;
  jitterMs: number;
  actionWeights: SimulationActionWeights;
};

/** Canonical persisted behavior for a newly created World. */
export const defaultSimulationConfig: SimulationConfigDefaults = {
  state: 'PAUSED',
  speedMultiplier: 1,
  intervalMs: 1_800_000,
  jitterMs: 300_000,
  actionWeights: {
    POST: 0.2,
    VOTE: 0.5,
    COMMENT: 0.3,
  },
};

/** Builds an independent config value for a new World. The nested weights are
 * copied so callers never share mutable JSON state across Worlds. */
export function createDefaultSimulationConfig(): SimulationConfigDefaults {
  return {
    ...defaultSimulationConfig,
    actionWeights: { ...defaultSimulationConfig.actionWeights },
  };
}
