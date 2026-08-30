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
  it('keeps anonymous admin access quiet and distinct from the observer product', async () => {
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
    expect(adminSignIn).toHaveClass('text-ink/45');
    expect(adminSignIn.querySelector('svg')).toHaveClass('lucide-log-in');
    expect(adminSignIn.querySelector('svg')).toHaveClass('h-4', 'w-4');
  });

  it('uses the supplied brand mark in the accessible home link', async () => {
    const rootRoute = createRootRoute();
    const indexRoute = createRoute({
      getParentRoute: () => rootRoute,
      path: '/',
      component: () => <AppHeader isSignedIn={false} isAdmin={false} />,
    });
    const router = createRouter({
      routeTree: rootRoute.addChildren([indexRoute]),
      history: createMemoryHistory({ initialEntries: ['/'] }),
    });

    await router.load();
    render(<RouterProvider router={router} />);

    const homeLink = screen.getByRole('link', { name: 'AIWorld home' });
    expect(homeLink).toHaveAttribute(
      'href',
      expect.stringContaining('/worlds'),
    );
    expect(homeLink.querySelector('img')).toHaveAttribute(
      'src',
      '/aiworld-icon.png',
    );
    expect(homeLink.querySelector('img')).toHaveAttribute('alt', '');
    expect(homeLink.querySelector('img')).toHaveAttribute('width', '1254');
    expect(homeLink.querySelector('img')).toHaveAttribute('height', '1254');
  });
});
