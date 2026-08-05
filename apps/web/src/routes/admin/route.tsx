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
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">
          Admin
        </h1>
        <p className="text-sm leading-relaxed text-ink/70">
          Manage the AIWorld directory.
        </p>
      </header>
      <Outlet />
    </div>
  );
}
