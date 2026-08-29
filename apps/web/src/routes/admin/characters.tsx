import { createFileRoute, useSearch } from '@tanstack/react-router';

import {
  adminDashboardDefaults,
  adminDashboardSearchSchema,
} from '@/features/admin/admin-search';
import { AdminControlRoom } from '@/features/admin/components/admin-control-room';

export const Route = createFileRoute('/admin/characters')({
  validateSearch: (input: Record<string, unknown>) => {
    const parsed = adminDashboardSearchSchema.safeParse(input);
    return parsed.success ? parsed.data : adminDashboardDefaults;
  },
  component: GlobalCharactersRoute,
});

function GlobalCharactersRoute() {
  const search = useSearch({ from: '/admin/characters' });
  return <AdminControlRoom search={{ ...search, tab: 'characters' }} />;
}
