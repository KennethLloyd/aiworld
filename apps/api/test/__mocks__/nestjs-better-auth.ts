/**
 * Minimal mock for @thallesp/nestjs-better-auth.
 *
 * The real package ships ESM .mjs with `import.meta.url` which Jest
 * cannot evaluate in CJS mode (even through ts-jest).  This mock
 * registers a deterministic global auth guard (APP_GUARD) backed by a
 * mutable session holder so e2e tests can exercise anonymous, USER, and
 * ADMIN access without the real BetterAuth package or a database.
 */
import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  Module,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { APP_GUARD, Reflector } from '@nestjs/core';

/** Minimal session shape consumed by the mock guard and e2e tests. */
export interface MockAuthSession {
  user: {
    role?: string | string[];
  };
  session?: Record<string, unknown>;
}

/** Mutable holder through which tests set the active mock session. */
export type MockAuthSessionHolder = {
  current: MockAuthSession | null;
};

/** Stable DI token for the {@link MockAuthSessionHolder} provider. */
export const MOCK_AUTH_SESSION = Symbol('MOCK_AUTH_SESSION');

/**
 * Global guard mirroring the real package's default AuthGuard: sets
 * request.session/request.user from the holder, honors the PUBLIC
 * (AllowAnonymous) and ROLES (Roles) metadata keys, rejects anonymous
 * requests on non-public routes with 401, and rejects role mismatches
 * with 403.
 */
@Injectable()
export class MockAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(MOCK_AUTH_SESSION)
    private readonly sessionHolder: MockAuthSessionHolder,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const session = this.sessionHolder.current;

    request.session = session;
    request.user = session?.user ?? null;

    const isPublic = this.reflector.getAllAndOverride<boolean>('PUBLIC', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    if (!session) {
      throw new UnauthorizedException();
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>('ROLES', [
      context.getHandler(),
      context.getClass(),
    ]);
    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = this.matchesRequiredRole(
        session.user.role,
        requiredRoles,
      );
      if (!hasRole) {
        throw new ForbiddenException();
      }
    }

    return true;
  }

  private matchesRequiredRole(
    role: string | string[] | undefined,
    requiredRoles: string[],
  ): boolean {
    if (!role) {
      return false;
    }

    if (Array.isArray(role)) {
      return role.some((r) => requiredRoles.includes(r));
    }

    if (typeof role === 'string') {
      return role.split(',').some((r) => requiredRoles.includes(r.trim()));
    }

    return false;
  }
}

const MOCK_AUTH_PROVIDERS = [
  {
    provide: MOCK_AUTH_SESSION,
    useValue: { current: null },
  },
  {
    provide: APP_GUARD,
    useClass: MockAuthGuard,
  },
];

@Module({})
export class AuthModule {
  static forRoot(_options?: Record<string, unknown>) {
    return {
      module: AuthModule,
      global: true,
      providers: MOCK_AUTH_PROVIDERS,
      exports: [MOCK_AUTH_SESSION],
    };
  }

  static forRootAsync(_options?: Record<string, unknown>) {
    return {
      module: AuthModule,
      global: true,
      providers: MOCK_AUTH_PROVIDERS,
      exports: [MOCK_AUTH_SESSION],
    };
  }
}

export const Roles = (roles: string[]) => SetMetadata('ROLES', roles);

export const AllowAnonymous = () => SetMetadata('PUBLIC', true);
