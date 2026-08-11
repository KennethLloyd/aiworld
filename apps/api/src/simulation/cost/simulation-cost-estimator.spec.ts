import { SimulationCostEstimator } from './simulation-cost-estimator';

describe('SimulationCostEstimator', () => {
  it('estimates cost from token usage', () => {
    const estimator = new SimulationCostEstimator({
      inputPerMillionUsd: 1,
      outputPerMillionUsd: 4,
    });

    expect(
      estimator.estimateUsd({
        prompt: 100_000,
        completion: 50_000,
        total: 150_000,
      }),
    ).toBe(0.3);
  });

  it('returns null when no token usage is available', () => {
    const estimator = new SimulationCostEstimator({
      inputPerMillionUsd: 1,
      outputPerMillionUsd: 1,
    });

    expect(estimator.estimateUsd(undefined)).toBeNull();
  });
});
