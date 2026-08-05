import { createAuthClient } from 'better-auth/client';
import type { Session } from 'better-auth/client';
import { inferAdditionalFields } from 'better-auth/client/plugins';

import { env } from '@/core/config/env';

export type UserRole = 'ADMIN' | 'USER';

/**
 * Better Auth's client User/Session types are type aliases (not interfaces),
 * so a module augmentation cannot add the backend's custom user fields, and
 * @better-auth/core is not resolvable from this workspace. The sanctioned
 * inferAdditionalFields client plugin types the raw response fields instead;
 * the authApi helpers below normalize them into the strict AuthUser shape the
 * rest of the app consumes (role: 'ADMIN' | 'USER', username, isDeleted).
 *
 * Better Auth endpoints live under /api/auth (verified against the installed
 * @thallesp/nestjs-better-auth adapter, which defaults basePath to /api/auth).
 * baseURL stays empty in dev so requests hit the same-origin /api/auth through
 * the Vite /api proxy; VITE_API_BASE_URL points at the API origin in
 * non-proxied deployments.
 */
export const authClient = createAuthClient({
  baseURL: env.apiBaseUrl || undefined,
  fetchOptions: { credentials: 'include' },
  plugins: [
    inferAdditionalFields({
      user: {
        role: { type: 'string', defaultValue: 'USER', input: false },
        username: { type: 'string', required: true },
        isDeleted: { type: 'boolean', defaultValue: false, input: false },
      },
    }),
  ],
});

export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image: string | null;
  createdAt: Date;
  updatedAt: Date;
  role: UserRole;
  username: string;
  isDeleted: boolean;
}

export interface AuthSession {
  session: Session;
  user: AuthUser;
}

/**
 * Structural shape of the user object the Better Auth client returns (the
 * plugin augments the inferred type with role/username/isDeleted; this keeps
 * the normalization decoupled from the client's deep generic inference).
 */
interface RawAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  name: string;
  image?: string | null;
  createdAt: Date;
  updatedAt: Date;
  role?: string | null;
  username?: string | null;
  isDeleted?: boolean | null;
}

function toUserRole(value: string | null | undefined): UserRole {
  // The backend guarantees 'ADMIN' | 'USER'; anything unexpected falls back
  // to 'USER' so a malformed role never crashes the shell.
  return value === 'ADMIN' ? 'ADMIN' : 'USER';
}

export function toAuthSession(raw: {
  session: Session;
  user: RawAuthUser;
}): AuthSession {
  return {
    session: raw.session,
    user: {
      id: raw.user.id,
      email: raw.user.email,
      emailVerified: raw.user.emailVerified,
      name: raw.user.name,
      image: raw.user.image ?? null,
      createdAt: raw.user.createdAt,
      updatedAt: raw.user.updatedAt,
      role: toUserRole(raw.user.role),
      username: raw.user.username ?? '',
      isDeleted: raw.user.isDeleted ?? false,
    },
  };
}

/** Small error type for the Better Auth boundary (never the API envelope). */
export class AuthError extends Error {
  readonly status: number;
  readonly code: string | undefined;

  constructor(message: string, status = 401, code?: string) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
    this.code = code;
  }
}

interface ClientErrorShape {
  message?: string;
  status: number;
  code?: string;
}

function toAuthError(error: ClientErrorShape, fallback: string): AuthError {
  return new AuthError(error.message ?? fallback, error.status, error.code);
}

/**
 * Normalized auth boundary: query/guard/mutation code consumes authApi, never
 * the raw Better Auth client response wrapper. Auth responses do NOT use the
 * backend's { statusCode, message, error } envelope, so ApiError parsing is
 * never applied here.
 */
export const authApi = {
  async getSession(): Promise<AuthSession | null> {
    const response = await authClient.getSession();
    if (response.error) {
      throw toAuthError(response.error, 'Failed to load session');
    }
    return response.data ? toAuthSession(response.data) : null;
  },

  async signIn(email: string, password: string): Promise<AuthSession> {
    const response = await authClient.signIn.email({ email, password });
    if (response.error) {
      throw toAuthError(response.error, 'Sign in failed');
    }
    if (!response.data?.user) {
      throw new AuthError(
        'Sign-in succeeded but returned no user',
        500,
        'SIGN_IN_NO_USER',
      );
    }
    // The sign-in response carries the user but not the session object; the
    // session cookie is set server-side, so fetch the canonical session.
    const session = await authApi.getSession();
    if (!session) {
      throw new AuthError(
        'Sign-in succeeded but no session was established',
        500,
        'SIGN_IN_NO_SESSION',
      );
    }
    return session;
  },

  async signOut(): Promise<void> {
    const response = await authClient.signOut();
    if (response.error) {
      throw toAuthError(response.error, 'Sign out failed');
    }
  },
};
