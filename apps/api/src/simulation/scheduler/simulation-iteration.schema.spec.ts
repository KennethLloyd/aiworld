import {
  deriveScheduledDelayMs,
  simulationIterationSchema,
  scheduledTurnSchema,
  simulationSpeedMultiplierSchema,
} from '@aiworld/shared/schemas/simulation-iteration.schema';

describe('shared simulation iteration contract', () => {
  describe('simulationIterationSchema', () => {
    const validIteration = {
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
      executionSource: 'scheduled',
      issuedAt: '2026-08-13T00:00:00.000Z',
    };

    it('accepts a fully-formed iteration', () => {
      expect(simulationIterationSchema.safeParse(validIteration).success).toBe(
        true,
      );
    });

    it.each(['POST', 'VOTE', 'COMMENT'] as const)(
      'accepts the %s action type',
      (actionType) => {
        expect(
          simulationIterationSchema.safeParse({ ...validIteration, actionType })
            .success,
        ).toBe(true);
      },
    );

    it.each(['scheduled', 'one-action', 'custom'] as const)(
      'accepts the %s execution source',
      (executionSource) => {
        expect(
          simulationIterationSchema.safeParse({
            ...validIteration,
            executionSource,
          }).success,
        ).toBe(true);
      },
    );

    it('rejects an unknown action type', () => {
      const result = simulationIterationSchema.safeParse({
        ...validIteration,
        actionType: 'DELETE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown execution source', () => {
      const result = simulationIterationSchema.safeParse({
        ...validIteration,
        executionSource: 'manual',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a malformed issuedAt timestamp', () => {
      const result = simulationIterationSchema.safeParse({
        ...validIteration,
        issuedAt: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('scheduledTurnSchema', () => {
    it('accepts only scheduled iterations', () => {
      const result = scheduledTurnSchema.safeParse({
        worldSlug: 'mbti-house',
        characterId: 'character-1',
        actionType: 'POST',
        executionSource: 'scheduled',
        issuedAt: '2026-08-13T00:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it.each(['one-action', 'custom'] as const)(
      'rejects the %s execution source',
      (executionSource) => {
        const result = scheduledTurnSchema.safeParse({
          worldSlug: 'mbti-house',
          characterId: 'character-1',
          actionType: 'POST',
          executionSource,
          issuedAt: '2026-08-13T00:00:00.000Z',
        });

        expect(result.success).toBe(false);
      },
    );
  });

  describe('simulationSpeedMultiplierSchema', () => {
    it('accepts the boundary values 0.1 and 100', () => {
      expect(simulationSpeedMultiplierSchema.safeParse(0.1).success).toBe(true);
      expect(simulationSpeedMultiplierSchema.safeParse(100).success).toBe(true);
    });

    it('accepts the seed pacing multiplier of 1', () => {
      expect(simulationSpeedMultiplierSchema.safeParse(1).success).toBe(true);
    });

    it.each([0.09, -1, 101, 0])('rejects %s', (value) => {
      expect(simulationSpeedMultiplierSchema.safeParse(value).success).toBe(
        false,
      );
    });
  });

  describe('deriveScheduledDelayMs', () => {
    it('returns the effective interval when jitter is zero', () => {
      expect(
        deriveScheduledDelayMs({
          intervalMs: 1800000,
          jitterMs: 0,
          speedMultiplier: 1,
        }),
      ).toBe(1800000);
    });

    it('scales the interval by the speed multiplier', () => {
      expect(
        deriveScheduledDelayMs({
          intervalMs: 1800000,
          jitterMs: 0,
          speedMultiplier: 2,
        }),
      ).toBe(900000);
    });

    it('adds a bounded jitter around the effective interval', () => {
      const random = jest.fn().mockReturnValue(0);
      expect(
        deriveScheduledDelayMs({
          intervalMs: 1800000,
          jitterMs: 300000,
          speedMultiplier: 1,
          random,
        }),
      ).toBe(1500000);

      const randomMax = jest.fn().mockReturnValue(0.999999);
      expect(
        deriveScheduledDelayMs({
          intervalMs: 1800000,
          jitterMs: 300000,
          speedMultiplier: 1,
          random: randomMax,
        }),
      ).toBe(2099999);
    });

    it('never returns a negative delay', () => {
      const random = jest.fn().mockReturnValue(0);
      expect(
        deriveScheduledDelayMs({
          intervalMs: 100,
          jitterMs: 10000,
          speedMultiplier: 100,
          random,
        }),
      ).toBe(0);
    });

    it('uses Math.random when no source is injected', () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      try {
        expect(
          deriveScheduledDelayMs({
            intervalMs: 1000,
            jitterMs: 200,
            speedMultiplier: 1,
          }),
        ).toBe(1000);
      } finally {
        spy.mockRestore();
      }
    });
  });
});
