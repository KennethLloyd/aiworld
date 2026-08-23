import { RouterProvider } from '@tanstack/react-router';

import { router } from '@/router/router';
import { AppErrorBoundary } from '@/shared/feedback/app-error-boundary';

export function App() {
  return (
    <AppErrorBoundary>
      <RouterProvider router={router} />
    </AppErrorBoundary>
  );
}
