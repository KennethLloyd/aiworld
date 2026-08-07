export type RequestUser = {
  role?: string | string[];
};

export type AuthenticatedRequest = {
  user?: RequestUser | null;
};

export function isAdminRequest(request: AuthenticatedRequest): boolean {
  const role = request.user?.role;

  if (Array.isArray(role)) {
    return role.includes('ADMIN');
  }

  return (
    role
      ?.split(',')
      .map((item) => item.trim())
      .includes('ADMIN') ?? false
  );
}
