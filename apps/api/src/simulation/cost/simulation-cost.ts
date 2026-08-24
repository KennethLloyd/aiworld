import { LlmProviderTokenUsage } from '@/simulation/providers/llm-provider.port';

/** Configured per-model rates used to estimate simulation cost. */
export type SimulationCostConfig = {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerMillionUsd: number;
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerMillionUsd: number;
};

export const defaultSimulationCostConfig: SimulationCostConfig = {
  inputPerMillionUsd: 0.15,
  outputPerMillionUsd: 0.6,
};

function envRate(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

export function loadSimulationCostConfig(
  env: Record<string, string | undefined> = process.env,
): SimulationCostConfig {
  return {
    inputPerMillionUsd: envRate(
      env.LLM_INPUT_COST_PER_MILLION_USD,
      defaultSimulationCostConfig.inputPerMillionUsd,
    ),
    outputPerMillionUsd: envRate(
      env.LLM_OUTPUT_COST_PER_MILLION_USD,
      defaultSimulationCostConfig.outputPerMillionUsd,
    ),
  };
}

/** Deterministic cost estimate from token usage, rounded to six decimals. */
export function estimateSimulationCostUsd(
  tokens: LlmProviderTokenUsage,
  config: SimulationCostConfig,
): number {
  const input = (tokens.prompt / 1_000_000) * config.inputPerMillionUsd;
  const output = (tokens.completion / 1_000_000) * config.outputPerMillionUsd;
  return Math.round((input + output) * 1_000_000) / 1_000_000;
}
