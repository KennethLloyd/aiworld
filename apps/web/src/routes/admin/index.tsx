import { createFileRoute } from '@tanstack/react-router';

import {
  adminDashboardDefaults,
  adminDashboardSearchSchema,
} from '@/features/admin/admin-search';
import { AdminControlRoom } from '@/features/admin/components/admin-control-room';

export const Route = createFileRoute('/admin/')({
  validateSearch: validateAdminDashboardSearch,
  component: AdminControlRoomRoute,
});

function AdminControlRoomRoute() {
  return <AdminControlRoom search={Route.useSearch()} />;
}

function validateAdminDashboardSearch(input: Record<string, unknown>) {
  const parsed = adminDashboardSearchSchema.safeParse(input);
  return parsed.success ? parsed.data : adminDashboardDefaults;
}
