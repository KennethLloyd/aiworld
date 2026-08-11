import { Injectable } from '@nestjs/common';

import { estimateSimulationCostUsd } from '@/simulation/cost/simulation-cost';
import type { SimulationCostConfig } from '@/simulation/cost/simulation-cost';
import type { LlmProviderTokenUsage } from '@/simulation/providers/llm-provider.port';

/** Turns provider token usage into a dollar figure. Separate from the
 * providers and from logging so both can be swapped or configured
 * independently (Plan 06 senior standard). */
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
