import { env } from '@/core/config/env';

import { parseErrorEnvelope } from './api-error';

/** Sends credentialed requests for feature API functions. */
export class HttpClient {
  constructor(private readonly baseUrl: string) {}

  async get<T>(path: string, signal?: AbortSignal): Promise<T> {
    return this.request<T>(path, { method: 'GET', signal });
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'POST',
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  }

  async delete(path: string): Promise<void> {
    await this.request<void>(path, { method: 'DELETE' });
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      credentials: 'include',
      headers: {
        Accept: 'application/json',
        ...(init.body !== undefined && init.body !== null
          ? { 'Content-Type': 'application/json' }
          : {}),
      },
    });

    if (!response.ok) {
      throw parseErrorEnvelope(response.status, await readJson(response));
    }

    // 204 responses have no JSON body.
    if (response.status === 204) {
      return undefined as T;
    }

    return (await readJson(response)) as T;
  }
}

export const apiClient = new HttpClient(env.apiBaseUrl);

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return undefined;
  }
}
