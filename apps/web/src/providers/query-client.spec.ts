import { describe, expect, it } from 'vitest';

import { ApiError } from '@/core/api/api-error';
import { sessionKeys } from '@/core/auth/session-keys';

import { createQueryClient } from './query-client';

/** Runs a failing mutation through the client's mutation cache. */
async function runMutation(client: ReturnType<typeof createQueryClient>) {
  const mutation = client.getMutationCache().build(client, {
    mutationKey: ['spec', 'mutation'],
    mutationFn: async () => {
      throw new ApiError(401, 'Unauthorized', 'Unauthorized');
    },
  });
  await expect(mutation.execute(undefined)).rejects.toBeInstanceOf(ApiError);
}

describe('createQueryClient', () => {
  it('clears the session cache and sets the expired marker on a 401 mutation', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, { placeholder: true });

    await runMutation(client);

    expect(client.getQueryData(sessionKeys.current)).toBeNull();
    expect(client.getQueryData(sessionKeys.expiredMarker)).toBe(true);
  });

  it('clears the session cache and sets the expired marker on a 401 query', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, { placeholder: true });

    await expect(
      client.fetchQuery({
        queryKey: ['spec', 'worlds'],
        queryFn: async () => {
          throw new ApiError(401, 'Unauthorized', 'Unauthorized');
        },
      }),
    ).rejects.toBeInstanceOf(ApiError);

    expect(client.getQueryData(sessionKeys.current)).toBeNull();
    expect(client.getQueryData(sessionKeys.expiredMarker)).toBe(true);
  });

  it('does not clear the session on 403 or other statuses', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, { placeholder: true });

    const forbidden = client.getMutationCache().build(client, {
      mutationKey: ['spec', 'forbidden'],
      mutationFn: async () => {
        throw new ApiError(403, 'Forbidden', 'Forbidden');
      },
    });
    await expect(forbidden.execute(undefined)).rejects.toBeInstanceOf(ApiError);

    expect(client.getQueryData(sessionKeys.current)).toEqual({
      placeholder: true,
    });
    expect(client.getQueryData(sessionKeys.expiredMarker)).toBeUndefined();
  });

  it('does not treat non-API errors as a session expiry', async () => {
    const client = createQueryClient();
    client.setQueryData(sessionKeys.current, { placeholder: true });

    const network = client.getMutationCache().build(client, {
      mutationKey: ['spec', 'network'],
      mutationFn: async () => {
        throw new Error('network down');
      },
    });
    await expect(network.execute(undefined)).rejects.toThrow('network down');

    expect(client.getQueryData(sessionKeys.current)).toEqual({
      placeholder: true,
    });
    expect(client.getQueryData(sessionKeys.expiredMarker)).toBeUndefined();
  });
});
