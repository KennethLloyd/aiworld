import {
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRootRoute,
  createRouter,
} from '@tanstack/react-router';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AppHeader } from './app-header';

describe('AppHeader', () => {
  it('uses the prototype terminal icon for anonymous admin sign-in', async () => {
    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => (
        <AppHeader isSignedIn={false} isAdmin={false} showObserverMode />
      ),
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    const adminSignIn = screen.getByRole('link', { name: 'Admin sign in' });
    expect(adminSignIn).toHaveAttribute('href', '/auth/sign-in');
    expect(adminSignIn).toHaveAttribute('title', 'Admin sign in');
    expect(adminSignIn).toHaveTextContent('Admin sign in');
    expect(adminSignIn).toHaveClass('opacity-100', 'text-ink/90');
    expect(adminSignIn.querySelector('svg')).toHaveClass('lucide-terminal');
    expect(adminSignIn.querySelector('svg')).toHaveClass('h-5', 'w-5');
  });
});
