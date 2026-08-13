import {
  deriveScheduledDelayMs,
  simulationCommandSchema,
  simulationSpeedMultiplierSchema,
} from '@aiworld/shared/schemas/simulation-command.schema';

describe('shared simulation command contract', () => {
  describe('simulationCommandSchema', () => {
    const validCommand = {
      worldSlug: 'mbti-house',
      characterId: 'character-1',
      actionType: 'POST',
      executionSource: 'scheduled',
      issuedAt: '2026-08-13T00:00:00.000Z',
    };

    it('accepts a fully-formed command', () => {
      expect(simulationCommandSchema.safeParse(validCommand).success).toBe(
        true,
      );
    });

    it.each(['POST', 'VOTE', 'COMMENT'] as const)(
      'accepts the %s action type',
      (actionType) => {
        expect(
          simulationCommandSchema.safeParse({ ...validCommand, actionType })
            .success,
        ).toBe(true);
      },
    );

    it.each(['scheduled', 'one-action', 'custom'] as const)(
      'accepts the %s execution source',
      (executionSource) => {
        expect(
          simulationCommandSchema.safeParse({
            ...validCommand,
            executionSource,
          }).success,
        ).toBe(true);
      },
    );

    it('rejects an unknown action type', () => {
      const result = simulationCommandSchema.safeParse({
        ...validCommand,
        actionType: 'DELETE',
      });
      expect(result.success).toBe(false);
    });

    it('rejects an unknown execution source', () => {
      const result = simulationCommandSchema.safeParse({
        ...validCommand,
        executionSource: 'manual',
      });
      expect(result.success).toBe(false);
    });

    it('rejects a malformed issuedAt timestamp', () => {
      const result = simulationCommandSchema.safeParse({
        ...validCommand,
        issuedAt: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });
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
