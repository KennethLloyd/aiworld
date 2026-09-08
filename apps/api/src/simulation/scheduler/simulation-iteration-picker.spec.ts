import { PrismaService } from '@/lib/database/prisma.service';
import { SimulationIterationPicker } from '@/simulation/scheduler/simulation-iteration-picker';
import { SimulationRandomSource } from '@/simulation/scheduler/simulation-random-source';
import { SimulationIterationPickError } from '@/simulation/scheduler/simulation-scheduler.error';

function createPicker(
  members: Array<
    { id: string; characterId: string } | { id: string; characterId: null }
  > = [],
) {
  const prisma = {
    worldMember: {
      findMany: jest.fn().mockResolvedValue(members),
      findFirst: jest.fn(),
    },
    post: { findMany: jest.fn().mockResolvedValue([]) },
    comment: { findMany: jest.fn().mockResolvedValue([]) },
    vote: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const randomSource = {
    next: jest.fn().mockReturnValue(0.5),
  } as unknown as SimulationRandomSource;
  const picker = new SimulationIterationPicker(
    prisma as unknown as PrismaService,
    randomSource,
  );
  return { picker, prisma };
}

const weights = { POST: 0.2, VOTE: 0.5, COMMENT: 0.3 };

describe('SimulationIterationPicker', () => {
  it('draws weighted actions and falls back to COMMENT for zero weights', () => {
    const { picker } = createPicker();
    expect(picker.pickAction(weights, () => 0.2)).toBe('VOTE');
    expect(picker.pickAction(weights, () => 0.7)).toBe('COMMENT');
    expect(
      picker.pickAction({ POST: 0, VOTE: 0, COMMENT: 0 }, () => 0.99),
    ).toBe('COMMENT');
  });

  it('forces POST when no target posts exist and otherwise preserves weights', async () => {
    const { picker, prisma } = createPicker();
    await expect(
      picker.pickAutomaticAction(
        'world-1',
        { POST: 0, VOTE: 0.5, COMMENT: 0.5 },
        () => 0.99,
      ),
    ).resolves.toBe('POST');
    prisma.post.findMany.mockResolvedValue([{ id: 'post-1' }]);
    await expect(
      picker.pickAutomaticAction('world-1', weights, () => 0.69),
    ).resolves.toBe('VOTE');
  });

  it('selects the least recently active character and breaks ties randomly', async () => {
    const { picker, prisma } = createPicker([
      { id: 'member-a', characterId: 'a' },
      { id: 'member-b', characterId: 'b' },
      { id: 'member-c', characterId: 'c' },
    ]);
    prisma.post.findMany.mockResolvedValue([
      {
        authorMemberId: 'member-a',
        createdAt: new Date('2026-08-13T10:00:00Z'),
      },
      {
        authorMemberId: 'member-c',
        createdAt: new Date('2026-08-13T11:00:00Z'),
      },
    ]);
    prisma.comment.findMany.mockResolvedValue([]);
    prisma.vote.findMany.mockResolvedValue([]);
    await expect(picker.pickCharacter('world-1', () => 0.99)).resolves.toEqual({
      characterId: 'b',
    });

    prisma.post.findMany.mockResolvedValue([
      {
        authorMemberId: 'member-a',
        createdAt: new Date('2026-08-13T09:00:00Z'),
      },
      {
        authorMemberId: 'member-b',
        createdAt: new Date('2026-08-13T09:00:00Z'),
      },
      {
        authorMemberId: 'member-c',
        createdAt: new Date('2026-08-13T10:00:00Z'),
      },
    ]);
    await expect(picker.pickCharacter('world-1', () => 0)).resolves.toEqual({
      characterId: 'a',
    });
    await expect(picker.pickCharacter('world-1', () => 0.99)).resolves.toEqual({
      characterId: 'b',
    });
  });

  it('throws when no active character exists and picks recent target posts', async () => {
    const empty = createPicker();
    await expect(
      empty.picker.pickCharacter('world-1', () => 0.5),
    ).rejects.toBeInstanceOf(SimulationIterationPickError);

    const { picker, prisma } = createPicker();
    prisma.post.findMany.mockResolvedValue([
      { id: 'p1' },
      { id: 'p2' },
      { id: 'p3' },
    ]);
    await expect(picker.pickTargetPost('world-1', () => 0)).resolves.toBe('p1');
    await expect(picker.pickTargetPost('world-1', () => 0.99)).resolves.toBe(
      'p3',
    );
  });
});
