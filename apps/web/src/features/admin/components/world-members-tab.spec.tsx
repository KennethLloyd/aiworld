import type { AdminCharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import type { WorldResponse } from '@aiworld/shared/schemas/world-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApiError } from '@/core/api/api-error';
import type { WorldMemberGateway } from '@/features/admin/api/world-member-gateway';
import type { AdminCharacterGateway } from '@/features/characters/api/character-gateway';
import { gateways, GatewaysProvider } from '@/providers/gateways-provider';
import { Toaster } from '@/shared/feedback/toaster';

import { WorldMembersTab } from './world-members-tab';

const world: WorldResponse = {
  id: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  name: 'The MBTI House',
  slug: 'mbti-house',
  description: { about: 'A simulated home for sixteen personalities.' },
  rules: ['Stay in character'],
  topicScope: 'Personality types and everyday life.',
  residentCount: 2,
  isActive: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

const activeCharacter = makeCharacter({
  id: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  name: 'Mystic Aura',
  handle: 'mystic_aura',
  isActive: true,
});
const inactiveCharacter = makeCharacter({
  id: '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12',
  name: 'Quiet Orbit',
  handle: 'quiet_orbit',
  isActive: false,
});
const candidateCharacter = makeCharacter({
  id: '9a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f13',
  name: 'Bright Signal',
  handle: 'bright_signal',
  isActive: true,
});

const activeMember = makeMember({
  id: 'aa3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f14',
  characterId: activeCharacter.id,
  isActive: true,
});
const inactiveMember = makeMember({
  id: 'ba3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f15',
  characterId: inactiveCharacter.id,
  isActive: true,
});

describe('WorldMembersTab', () => {
  it('joins identities, preserves separate states, assigns candidates, and confirms deactivation', async () => {
    const user = userEvent.setup();
    const listMembers = vi
      .fn<WorldMemberGateway['list']>()
      .mockResolvedValue(paginated([activeMember, inactiveMember]));
    const createMember = vi
      .fn<WorldMemberGateway['create']>()
      .mockResolvedValue(
        makeMember({
          id: 'ca3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f16',
          characterId: candidateCharacter.id,
        }),
      );
    const updateMember = vi
      .fn<WorldMemberGateway['update']>()
      .mockResolvedValue({ ...activeMember, isActive: false });
    const listCharacters = vi
      .fn<AdminCharacterGateway['listAdmin']>()
      .mockResolvedValue(
        paginated([activeCharacter, inactiveCharacter, candidateCharacter]),
      );

    renderMembers({
      worldMemberGateway: {
        list: listMembers,
        create: createMember,
        update: updateMember,
      },
      adminCharacterGateway: makeAdminCharacterGateway(listCharacters),
    });

    expect((await screen.findAllByText('Mystic Aura')).length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText('Inactive').length).toBeGreaterThan(0);
    expect(
      screen.getAllByText('Character inactive; membership remains active.')
        .length,
    ).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Add Residents' }));
    expect(
      await screen.findByRole('heading', {
        name: 'Add Residents to The MBTI House',
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Bright Signal').length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Assign Bright Signal' })[0],
    ).toBeEnabled();

    await user.click(
      screen.getAllByRole('button', { name: 'Assign Bright Signal' })[0]!,
    );
    await waitFor(() =>
      expect(createMember).toHaveBeenCalledWith({
        worldSlug: world.slug,
        characterId: candidateCharacter.id,
        isActive: true,
      }),
    );
    await user.click(
      within(
        screen.getByRole('dialog', {
          name: 'Add Residents to The MBTI House',
        }),
      ).getAllByRole('button', { name: 'Close dialog' })[0]!,
    );

    await user.click(
      screen.getAllByRole('button', {
        name: 'Deactivate membership for Mystic Aura',
      })[0]!,
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'Global Character status is unchanged.',
    );
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Deactivate membership',
      }),
    );
    await waitFor(() =>
      expect(updateMember).toHaveBeenCalledWith(activeMember.id, {
        isActive: false,
      }),
    );
  });

  it('debounces server-side candidate search and disables inactive candidates', async () => {
    const user = userEvent.setup();
    const listMembers = vi
      .fn<WorldMemberGateway['list']>()
      .mockResolvedValue(paginated([]));
    const searchRequests: string[] = [];
    const listCharacters = vi
      .fn<AdminCharacterGateway['listAdmin']>()
      .mockImplementation(async (query) => {
        searchRequests.push(query.search ?? '');
        return paginated([
          makeCharacter({
            id: 'da3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f17',
            name: 'Dormant Signal',
            handle: 'dormant_signal',
            isActive: false,
          }),
        ]);
      });

    renderMembers({
      worldMemberGateway: {
        list: listMembers,
        create: vi.fn<WorldMemberGateway['create']>(),
        update: vi.fn<WorldMemberGateway['update']>(),
      },
      adminCharacterGateway: makeAdminCharacterGateway(listCharacters),
    });
    await user.click(screen.getByRole('button', { name: 'Add Residents' }));

    expect(
      (await screen.findAllByText('Dormant Signal')).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole('button', { name: 'Assign Dormant Signal' })[0],
    ).toBeDisabled();

    const search = screen.getByLabelText('Search Characters');
    await user.type(search, 'signal');
    await waitFor(() => expect(searchRequests.at(-1)).toBe('signal'), {
      timeout: 1_000,
    });
    expect(searchRequests.filter((value) => value === 'signal')).toHaveLength(
      1,
    );
  });

  it('loads candidates across the full Character directory before filtering', async () => {
    const user = userEvent.setup();
    const listMembers = vi
      .fn<WorldMemberGateway['list']>()
      .mockResolvedValue(paginated([]));
    const listCharacters = vi
      .fn<AdminCharacterGateway['listAdmin']>()
      .mockImplementation(async (query) => {
        if (query.page === 1) {
          return paginatedPage([activeCharacter], 1, 2);
        }

        return paginatedPage([candidateCharacter], 2, 2);
      });

    renderMembers({
      worldMemberGateway: {
        list: listMembers,
        create: vi.fn<WorldMemberGateway['create']>(),
        update: vi.fn<WorldMemberGateway['update']>(),
      },
      adminCharacterGateway: makeAdminCharacterGateway(listCharacters),
    });
    await user.click(screen.getByRole('button', { name: 'Add Residents' }));

    expect(
      (
        await screen.findAllByRole('button', { name: 'Assign Bright Signal' })
      )[0],
    ).toBeEnabled();
    expect(listCharacters).toHaveBeenCalledWith({
      page: 2,
      limit: 100,
      search: undefined,
    });
  });

  it('surfaces duplicate assignment conflicts and refreshes the reads', async () => {
    const user = userEvent.setup();
    const listMembers = vi
      .fn<WorldMemberGateway['list']>()
      .mockResolvedValue(paginated([]));
    const conflict = new ApiError(
      409,
      'Character is already assigned to this World',
      'Conflict',
    );
    const createMember = vi
      .fn<WorldMemberGateway['create']>()
      .mockRejectedValue(conflict);
    const listCharacters = vi
      .fn<AdminCharacterGateway['listAdmin']>()
      .mockResolvedValue(paginated([candidateCharacter]));

    renderMembers({
      worldMemberGateway: {
        list: listMembers,
        create: createMember,
        update: vi.fn<WorldMemberGateway['update']>(),
      },
      adminCharacterGateway: makeAdminCharacterGateway(listCharacters),
    });
    await user.click(screen.getByRole('button', { name: 'Add Residents' }));

    await user.click(
      (
        await screen.findAllByRole('button', {
          name: 'Assign Bright Signal',
        })
      )[0]!,
    );

    expect(
      await screen.findByText('Character is already assigned to this World'),
    ).toBeInTheDocument();
    expect(listMembers.mock.calls.length).toBeGreaterThan(1);
  });

  it('renders forbidden states for the membership and candidate panels independently', async () => {
    const forbidden = new ApiError(403, 'Forbidden', 'Forbidden');
    const listMembers = vi
      .fn<WorldMemberGateway['list']>()
      .mockResolvedValue(paginated([]));
    const listCharacters = vi
      .fn<AdminCharacterGateway['listAdmin']>()
      .mockRejectedValue(forbidden);

    renderMembers({
      worldMemberGateway: {
        list: listMembers,
        create: vi.fn<WorldMemberGateway['create']>(),
        update: vi.fn<WorldMemberGateway['update']>(),
      },
      adminCharacterGateway: makeAdminCharacterGateway(listCharacters),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Residents' }),
    );

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', {
        name: 'Add Residents to The MBTI House',
      }),
    ).toBeInTheDocument();
  });

  it('keeps assignment candidates available when membership loading is forbidden', async () => {
    const forbidden = new ApiError(403, 'Forbidden', 'Forbidden');
    const listMembers = vi
      .fn<WorldMemberGateway['list']>()
      .mockRejectedValue(forbidden);
    const listCharacters = vi
      .fn<AdminCharacterGateway['listAdmin']>()
      .mockResolvedValue(paginated([candidateCharacter]));

    renderMembers({
      worldMemberGateway: {
        list: listMembers,
        create: vi.fn<WorldMemberGateway['create']>(),
        update: vi.fn<WorldMemberGateway['update']>(),
      },
      adminCharacterGateway: makeAdminCharacterGateway(listCharacters),
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Add Residents' }),
    );

    expect(await screen.findByText('Access denied')).toBeInTheDocument();
    expect(
      (
        await screen.findAllByRole('button', { name: 'Assign Bright Signal' })
      ).every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
});

function renderMembers({
  worldMemberGateway,
  adminCharacterGateway,
}: {
  worldMemberGateway: WorldMemberGateway;
  adminCharacterGateway: AdminCharacterGateway;
}) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <QueryClientProvider client={client}>
      <GatewaysProvider
        value={{
          ...gateways,
          worldMemberGateway,
          adminCharacterGateway,
        }}
      >
        <Toaster>
          <WorldMembersTab world={world} />
        </Toaster>
      </GatewaysProvider>
    </QueryClientProvider>,
  );
}

function makeAdminCharacterGateway(
  listAdmin: AdminCharacterGateway['listAdmin'],
): AdminCharacterGateway {
  return {
    listAdmin,
    getAdminById: vi.fn<AdminCharacterGateway['getAdminById']>(),
    create: vi.fn<AdminCharacterGateway['create']>(),
    update: vi.fn<AdminCharacterGateway['update']>(),
  };
}

function makeCharacter(
  overrides: Partial<AdminCharacterResponse> &
    Pick<AdminCharacterResponse, 'id' | 'name' | 'handle' | 'isActive'>,
): AdminCharacterResponse {
  return {
    id: overrides.id,
    handle: overrides.handle,
    name: overrides.name,
    classification: 'INFJ',
    classificationGroup: 'NF',
    avatarUrl: null,
    biography: 'A reusable Character.',
    traits: ['Curious'],
    isActive: overrides.isActive,
    createdAt: '2026-07-01T10:00:00.000Z',
    updatedAt: '2026-07-15T10:00:00.000Z',
    systemPrompt: 'You are a resident.',
  };
}

function makeMember({
  id,
  characterId,
  isActive,
}: {
  id: string;
  characterId: string;
  isActive?: boolean;
}): WorldMemberResponse {
  return {
    id,
    worldId: world.id,
    worldSlug: world.slug,
    characterId,
    userId: null,
    role: 'AI',
    isActive: isActive ?? true,
    joinedAt: '2026-07-15T10:00:00.000Z',
  };
}

function paginated<T>(items: T[]) {
  return {
    items,
    meta: {
      page: 1,
      limit: items.length || 20,
      total: items.length,
      totalPages: 1,
    },
  };
}

function paginatedPage<T>(items: T[], page: number, totalPages: number) {
  return {
    items,
    meta: {
      page,
      limit: 100,
      total: totalPages,
      totalPages,
    },
  };
}
