import { Injectable } from '@nestjs/common';

import { estimateSimulationCostUsd } from '@/simulation/cost/simulation-cost';
import type { SimulationCostConfig } from '@/simulation/cost/simulation-cost';
import type { LlmProviderTokenUsage } from '@/simulation/providers/llm-provider.port';

/** Estimates cost independently from providers and logging. */
@Injectable()
export class SimulationCostEstimator {
  constructor(private readonly config: SimulationCostConfig) {}

  estimateUsd(tokens: LlmProviderTokenUsage | undefined): number | null {
    if (tokens === undefined) {
      return null;
    }
    return estimateSimulationCostUsd(tokens, this.config);
  }
}
