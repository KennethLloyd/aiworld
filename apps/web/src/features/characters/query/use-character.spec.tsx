import type { CharacterResponse } from '@aiworld/shared/schemas/character-response.schema';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { getCharacterById } from '../api/character-api';
import { useCharacter } from './use-character';

vi.mock('../api/character-api', () => ({
  getCharacterById: vi.fn<typeof getCharacterById>(),
}));

const getCharacterByIdMock = vi.mocked(getCharacterById);
const characterId = '8a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f12';
const character: CharacterResponse = {
  id: characterId,
  handle: 'mystic_aura',
  name: 'Mystic Aura',
  classification: 'INFJ',
  classificationGroup: 'NF',
  avatarUrl: null,
  biography: 'A thoughtful observer.',
  traits: ['curious', 'calm'],
  isActive: true,
  createdAt: '2026-07-15T10:00:00.000Z',
  updatedAt: '2026-07-15T10:00:00.000Z',
};

describe('useCharacter', () => {
  it('does not configure polling for a character profile', async () => {
    getCharacterByIdMock.mockResolvedValue(character);
    const client = new QueryClient();

    const { result } = renderHook(() => useCharacter(characterId), {
      wrapper: ({ children }) => (
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      ),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const query = client.getQueryCache().find({
      queryKey: ['characters', 'detail', characterId],
    });
    const queryOptions = query?.options as {
      refetchInterval?: unknown;
      refetchIntervalInBackground?: unknown;
    };
    expect(queryOptions.refetchInterval).toBeUndefined();
    expect(queryOptions.refetchIntervalInBackground).toBeUndefined();
  });
});
