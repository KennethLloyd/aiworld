import {
  defaultSimulationCostConfig,
  estimateSimulationCostUsd,
  loadSimulationCostConfig,
} from './simulation-cost';

describe('simulation cost', () => {
  describe('loadSimulationCostConfig', () => {
    it('applies defaults when no environment is set', () => {
      expect(loadSimulationCostConfig({})).toEqual(defaultSimulationCostConfig);
    });

    it('reads configurable rates from the environment', () => {
      const config = loadSimulationCostConfig({
        LLM_INPUT_COST_PER_MILLION_USD: '1.5',
        LLM_OUTPUT_COST_PER_MILLION_USD: '3',
      });

      expect(config).toEqual({
        inputPerMillionUsd: 1.5,
        outputPerMillionUsd: 3,
      });
    });

    it('treats empty and invalid values as absent', () => {
      expect(
        loadSimulationCostConfig({
          LLM_INPUT_COST_PER_MILLION_USD: '',
          LLM_OUTPUT_COST_PER_MILLION_USD: 'nope',
        }),
      ).toEqual(defaultSimulationCostConfig);
    });
  });

  describe('estimateSimulationCostUsd', () => {
    it('computes cost from prompt and completion tokens', () => {
      const config = {
        inputPerMillionUsd: 1,
        outputPerMillionUsd: 4,
      };

      expect(
        estimateSimulationCostUsd(
          { prompt: 100_000, completion: 50_000, total: 150_000 },
          config,
        ),
      ).toBe(0.3);
    });

    it('is deterministic and rounds to six decimals', () => {
      const config = {
        inputPerMillionUsd: 0.15,
        outputPerMillionUsd: 0.6,
      };
      const tokens = {
        prompt: 1_111_111,
        completion: 1_111_111,
        total: 2_222_222,
      };

      const first = estimateSimulationCostUsd(tokens, config);
      const second = estimateSimulationCostUsd(tokens, config);

      expect(first).toBe(second);
      expect(Number.isInteger(first * 1_000_000)).toBe(true);
    });

    it('costs zero tokens as zero', () => {
      expect(
        estimateSimulationCostUsd(
          { prompt: 0, completion: 0, total: 0 },
          { inputPerMillionUsd: 1, outputPerMillionUsd: 1 },
        ),
      ).toBe(0);
    });
  });
});
