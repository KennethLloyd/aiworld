import type { ProviderConfig } from '@/lib/llm/provider-config';

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
  providerId: ProviderConfig['providerId'];
  model: string;
};

export const defaultSimulationConfig: Omit<
  SimulationConfigDefaults,
  'providerId' | 'model'
> = {
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

export type SimulationProviderSelection = Pick<
  ProviderConfig,
  'providerId' | 'model'
>;

/** Builds an independent config value for a new World. The nested weights are
 * copied so callers never share mutable JSON state across Worlds. */
export function createDefaultSimulationConfig(
  provider: SimulationProviderSelection = {
    providerId: 'mock',
    model: 'mock',
  },
): SimulationConfigDefaults {
  return {
    ...defaultSimulationConfig,
    actionWeights: { ...defaultSimulationConfig.actionWeights },
    providerId: provider.providerId,
    model: provider.model,
  };
}
