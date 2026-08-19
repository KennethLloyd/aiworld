import { createFileRoute, Outlet } from '@tanstack/react-router';

import { requireAdmin } from '@/router/guards/require-admin';

export const Route = createFileRoute('/admin')({
  // One parent beforeLoad guard covers every /admin child.
  beforeLoad: requireAdmin,
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex flex-col gap-6">
      <Outlet />
    </div>
  );
}
