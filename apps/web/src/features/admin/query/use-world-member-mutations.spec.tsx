import type { WorldMemberResponse } from '@aiworld/shared/schemas/world-member-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { WorldMemberGateway } from '@/features/admin/api/world-member-gateway';
import { characterKeys } from '@/features/characters/query/character-keys';
import { worldKeys } from '@/features/worlds/query/world-keys';
import { gateways, GatewaysProvider } from '@/providers/gateways-provider';

import { useAssignWorldMember } from './use-world-member-mutations';
import { worldMemberKeys } from './world-member-keys';

const input = {
  worldSlug: 'mbti-house',
  characterId: '7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11',
  isActive: true,
} as const;

const member: WorldMemberResponse = {
  id: 'aa3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f14',
  worldId: '6a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f10',
  worldSlug: input.worldSlug,
  characterId: input.characterId,
  userId: null,
  role: 'AI',
  isActive: true,
  joinedAt: '2026-07-15T10:00:00.000Z',
};

describe('world member mutations', () => {
  it('invalidates membership, Character, World list, and World detail reads', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries');
    const create = vi
      .fn<WorldMemberGateway['create']>()
      .mockResolvedValue(member);
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>
        <GatewaysProvider
          value={{
            ...gateways,
            worldMemberGateway: {
              ...gateways.worldMemberGateway,
              create,
            },
          }}
        >
          {children}
        </GatewaysProvider>
      </QueryClientProvider>
    );

    const { result } = renderHook(() => useAssignWorldMember(), { wrapper });

    await result.current.mutateAsync(input);

    await waitFor(() =>
      expect(invalidateQueries).toHaveBeenCalledWith({
        queryKey: worldMemberKeys.world(input.worldSlug),
      }),
    );
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: characterKeys.adminLists(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: characterKeys.lists(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: worldKeys.lists(),
    });
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: worldKeys.details(),
    });
  });
});
