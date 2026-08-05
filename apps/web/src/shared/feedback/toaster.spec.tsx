import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Toaster, useToast } from './toaster';

function Trigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ tone: 'success', title: 'Saved' })}
    >
      Push success
    </button>
  );
}

function ErrorTrigger() {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={() => toast({ tone: 'error', title: 'Failed' })}
    >
      Push error
    </button>
  );
}

function setup() {
  return render(
    <Toaster>
      <Trigger />
      <ErrorTrigger />
    </Toaster>,
  );
}

describe('Toaster', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders a toast and dismisses it via the dismiss button', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Push success' }));

    const toast = screen.getByRole('status');
    expect(toast).toHaveTextContent('Saved');
    expect(
      screen.getByRole('region', { name: 'Notifications' }),
    ).toContainElement(toast);

    fireEvent.click(
      screen.getByRole('button', { name: 'Dismiss notification' }),
    );
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders error toasts with role alert', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Push error' }));

    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('auto-dismisses after the timeout and pauses on hover', () => {
    vi.useFakeTimers();
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Push success' }));
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Pause on hover: no dismiss while hovered, even after the timeout.
    fireEvent.mouseEnter(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(screen.getByRole('status')).toBeInTheDocument();

    // Resume after leaving: the toast dismisses.
    fireEvent.mouseLeave(screen.getByRole('status'));
    act(() => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('dismisses the most recent toast on Escape', () => {
    setup();

    fireEvent.click(screen.getByRole('button', { name: 'Push success' }));
    fireEvent.click(screen.getByRole('button', { name: 'Push error' }));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.getByRole('alert')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
  });
});
