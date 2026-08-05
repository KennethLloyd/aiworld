import type { AuthSession, UserRole } from '@/core/auth/auth-client';

/**
 * Test fixtures for auth-backed routes and guards. The session shape mirrors
 * what authApi.getSession() resolves (AuthSession), with the role chosen by
 * the fixture so admin-guard and guest-only tests stay deterministic.
 */
export function makeSession(role: UserRole = 'ADMIN'): AuthSession {
  return {
    session: {
      id: 'session-1',
      token: 'token-1',
      userId: 'user-1',
      expiresAt: new Date('2027-01-01T00:00:00.000Z'),
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      ipAddress: null,
      userAgent: null,
    },
    user: {
      id: 'user-1',
      email: `${role === 'ADMIN' ? 'admin' : 'user'}@aiworld.test`,
      emailVerified: true,
      name: role === 'ADMIN' ? 'Admin User' : 'Plain User',
      image: null,
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
      role,
      username: role === 'ADMIN' ? 'admin' : 'user',
      isDeleted: false,
    },
  };
}
