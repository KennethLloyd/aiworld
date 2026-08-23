import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppErrorBoundary, type AppErrorReporter } from './app-error-boundary';

function BrokenScreen(): never {
  throw new Error('private provider details must not be rendered');
}

describe('AppErrorBoundary', () => {
  it('renders a safe recovery surface without exposing the caught error', () => {
    const originalError = console.error;
    console.error = () => undefined;
    const reporter = vi.fn<(event: Parameters<AppErrorReporter>[0]) => void>();

    try {
      render(
        <AppErrorBoundary reporter={reporter}>
          <BrokenScreen />
        </AppErrorBoundary>,
      );
    } finally {
      console.error = originalError;
    }

    expect(
      screen.getByRole('heading', { name: 'AIWorld needs a refresh' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/private provider details/),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    expect(reporter).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'render-error',
        errorName: 'Error',
        route: expect.any(String),
      }),
    );
    expect(JSON.stringify(reporter.mock.calls[0])).not.toContain(
      'private provider details',
    );
  });
});
