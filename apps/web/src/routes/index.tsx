import { Navigate, createFileRoute } from '@tanstack/react-router';

import { publicListWorldsDefaults } from '@/features/worlds/api/world-gateway';

// "/" has a single canonical destination: the public world list.
export const Route = createFileRoute('/')({
  component: HomeRedirect,
});

function HomeRedirect() {
  return <Navigate to="/worlds" search={publicListWorldsDefaults} replace />;
}
