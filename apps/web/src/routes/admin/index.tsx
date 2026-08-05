import { Navigate, createFileRoute } from '@tanstack/react-router';

import { adminWorldsDefaults } from '@/routes/admin/worlds';

export const Route = createFileRoute('/admin/')({
  component: AdminIndexRedirect,
});

function AdminIndexRedirect() {
  return <Navigate to="/admin/worlds" search={adminWorldsDefaults} replace />;
}
