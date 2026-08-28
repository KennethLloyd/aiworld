import type { ProviderConfig } from '@/lib/llm/provider-config';

export const defaultSimulationConfig = {
  state: 'PAUSED' as const,
  speedMultiplier: 1,
  intervalMs: 1_800_000,
  jitterMs: 300_000,
  actionWeights: {
    POST: 0.2,
    VOTE: 0.5,
    COMMENT: 0.3,
  },
} as const;

export type SimulationProviderSelection = Pick<
  ProviderConfig,
  'providerId' | 'model'
>;

/** Builds an independent config value for a new World. The nested weights are
 * copied so callers never share mutable JSON state across Worlds. */
export function createDefaultSimulationConfig(
  provider: SimulationProviderSelection = {
    providerId: 'mock',
    model: 'fixture-model',
  },
) {
  return {
    ...defaultSimulationConfig,
    actionWeights: { ...defaultSimulationConfig.actionWeights },
    providerId: provider.providerId,
    model: provider.model,
  };
}
