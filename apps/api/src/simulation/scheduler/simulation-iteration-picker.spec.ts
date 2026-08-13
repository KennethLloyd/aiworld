import { ActiveActorCandidate } from '@/simulation/scheduler/simulation-casting-repository.interface';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';

function actor(
  characterId: string,
  lastActivityAt: Date | null,
): ActiveActorCandidate {
  return { memberId: `member-${characterId}`, characterId, lastActivityAt };
}

function createPicker(candidates: ActiveActorCandidate[] = []) {
  const castingRepository = {
    findActiveActors: jest.fn().mockResolvedValue(candidates),
    findRecentPostIds: jest.fn().mockResolvedValue([]),
  };
  const picker = new SimulationIterationPicker(castingRepository as never);
  return { picker, castingRepository };
}

const weights = { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 };

describe('SimulationIterationPicker', () => {
  describe('pickAction', () => {
    it('is a weighted random draw over POST, VOTE, and COMMENT', () => {
      const { picker } = createPicker();

      expect(picker.pickAction(weights, () => 0.0)).toBe('POST');
      expect(picker.pickAction(weights, () => 0.19)).toBe('POST');
      expect(picker.pickAction(weights, () => 0.2)).toBe('VOTE');
      expect(picker.pickAction(weights, () => 0.69)).toBe('VOTE');
      expect(picker.pickAction(weights, () => 0.7)).toBe('COMMENT');
      expect(picker.pickAction(weights, () => 0.99)).toBe('COMMENT');
    });

    it('always returns an action even with zero weights', () => {
      const { picker } = createPicker();
      expect(
        picker.pickAction({ POST: 0, VOTE: 0, COMMENT: 0 }, () => 0.99),
      ).toBe('COMMENT');
    });
  });

  describe('pickCharacter', () => {
    it('prefers a resident who has never acted', async () => {
      const { picker, castingRepository } = createPicker([
        actor('a', new Date('2026-08-13T10:00:00Z')),
        actor('b', null),
        actor('c', new Date('2026-08-13T09:00:00Z')),
      ]);

      await expect(
        picker.pickCharacter('world-1', () => 0.99),
      ).resolves.toEqual({ characterId: 'b', memberId: 'member-b' });
      expect(castingRepository.findActiveActors).toHaveBeenCalledWith(
        'world-1',
      );
    });

    it('prefers the least-recently-active resident', async () => {
      const { picker } = createPicker([
        actor('a', new Date('2026-08-13T10:00:00Z')),
        actor('b', new Date('2026-08-13T09:00:00Z')),
        actor('c', new Date('2026-08-13T11:00:00Z')),
      ]);

      await expect(
        picker.pickCharacter('world-1', () => 0.99),
      ).resolves.toEqual({ characterId: 'b', memberId: 'member-b' });
    });

    it('breaks ties among equally active residents at random', async () => {
      const { picker } = createPicker([
        actor('a', new Date('2026-08-13T09:00:00Z')),
        actor('b', new Date('2026-08-13T09:00:00Z')),
        actor('c', new Date('2026-08-13T11:00:00Z')),
      ]);

      await expect(picker.pickCharacter('world-1', () => 0.0)).resolves.toEqual(
        { characterId: 'a', memberId: 'member-a' },
      );
      await expect(
        picker.pickCharacter('world-1', () => 0.99),
      ).resolves.toEqual({ characterId: 'b', memberId: 'member-b' });
    });

    it('throws when the world has no active residents', async () => {
      const { picker } = createPicker([]);

      await expect(
        picker.pickCharacter('world-1', () => 0.5),
      ).rejects.toBeInstanceOf(SimulationIterationPickError);
    });
  });

  describe('pickTargetPost', () => {
    it('picks a recent post at random', async () => {
      const { picker, castingRepository } = createPicker();
      castingRepository.findRecentPostIds.mockResolvedValue(['p1', 'p2', 'p3']);

      await expect(picker.pickTargetPost('world-1', () => 0.0)).resolves.toBe(
        'p1',
      );
      await expect(picker.pickTargetPost('world-1', () => 0.66)).resolves.toBe(
        'p2',
      );
      await expect(picker.pickTargetPost('world-1', () => 0.99)).resolves.toBe(
        'p3',
      );
      expect(castingRepository.findRecentPostIds).toHaveBeenCalledWith(
        'world-1',
        expect.any(Number),
      );
    });

    it('returns null when the world has no posts', async () => {
      const { picker } = createPicker();

      await expect(picker.pickTargetPost('world-1')).resolves.toBeNull();
    });
  });
});
