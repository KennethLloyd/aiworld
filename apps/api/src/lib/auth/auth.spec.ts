import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { openAPI } from 'better-auth/plugins';

jest.mock('better-auth', () => ({ betterAuth: jest.fn() }));
jest.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: jest.fn(() => ({ adapter: true })),
}));
jest.mock('better-auth/plugins', () => ({
  openAPI: jest.fn(() => ({ plugin: 'open-api' })),
}));
jest.mock('@/generated/prisma/client', () => ({ PrismaClient: jest.fn() }));

import type { PrismaClient } from '@/generated/prisma/client';
import { resolveAppConfig } from '@/lib/config/environment';
import { UserRole } from '@/types/userRole';

import { createAuth } from './auth';

const mockPrisma: PrismaClient = {} as unknown as PrismaClient;

describe('createAuth', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('calls betterAuth exactly once', () => {
    createAuth(mockPrisma);

    expect(betterAuth).toHaveBeenCalledTimes(1);
  });

  it('passes the supplied prisma client to prismaAdapter with postgresql provider', () => {
    createAuth(mockPrisma);

    expect(prismaAdapter).toHaveBeenCalledWith(mockPrisma, {
      provider: 'postgresql',
    });
  });

  it('configures emailAndPassword with enabled: true', () => {
    createAuth(mockPrisma);

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({ emailAndPassword: { enabled: true } }),
    );
  });

  it('configures the resolved base URL and trusted frontend origins', () => {
    const config = resolveAppConfig({
      API_PORT: '4000',
      WEB_PORT: '5174',
    });

    createAuth(mockPrisma, config);

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:4000',
        trustedOrigins: ['http://localhost:5174'],
      }),
    );
  });

  it('configures user.additionalFields with correct defaults', () => {
    createAuth(mockPrisma);

    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        user: expect.objectContaining({
          additionalFields: expect.objectContaining({
            username: {
              type: 'string',
              required: true,
              unique: true,
            },
            role: {
              type: 'string',
              defaultValue: 'USER' satisfies UserRole,
              input: false,
            },
            isDeleted: {
              type: 'boolean',
              defaultValue: false,
              input: false,
            },
          }),
        }),
      }),
    );
  });

  it('registers openAPI plugin with path docs', () => {
    createAuth(mockPrisma);

    expect(openAPI).toHaveBeenCalledWith({ path: 'docs' });
  });

  it('returns the result of betterAuth()', () => {
    const authInstance = { auth: true };
    jest
      .mocked(betterAuth)
      .mockReturnValueOnce(
        authInstance as unknown as ReturnType<typeof betterAuth>,
      );

    const result = createAuth(mockPrisma);

    expect(result).toBe(authInstance);
  });
});
