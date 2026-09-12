import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { RecentEventsCard } from './recent-events-card';

afterEach(() => cleanup());

describe('RecentEventsCard', () => {
  it('renders resident handles as safe, visually accented text', () => {
    render(
      <RecentEventsCard
        recentEvents="@readthemanual noticed a loose hinge."
        isPending={false}
      />,
    );

    const handle = screen.getByText('@readthemanual');
    expect(handle.tagName).toBe('SPAN');
    expect(handle).toHaveClass('text-brand-sentinel');
    expect(
      screen.queryByRole('button', { name: 'Show more' }),
    ).not.toBeInTheDocument();
  });

  it('offers an accessible toggle only when the mobile briefing is truncated', async () => {
    const originalScrollHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'scrollHeight',
    );
    const originalClientHeight = Object.getOwnPropertyDescriptor(
      HTMLElement.prototype,
      'clientHeight',
    );
    Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
      configurable: true,
      get: () => 96,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientHeight', {
      configurable: true,
      get: () => 48,
    });

    try {
      render(
        <RecentEventsCard
          recentEvents="A long briefing describes several connected developments that residents are still discussing across the House."
          isPending={false}
        />,
      );

      const toggle = screen.getByRole('button', { name: 'Show more' });
      expect(toggle).toHaveAttribute('aria-expanded', 'false');
      expect(toggle).toHaveAttribute('aria-controls', 'recent-events-briefing');

      await userEvent.click(toggle);

      expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    } finally {
      if (originalScrollHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'scrollHeight',
          originalScrollHeight,
        );
      }
      if (originalClientHeight) {
        Object.defineProperty(
          HTMLElement.prototype,
          'clientHeight',
          originalClientHeight,
        );
      }
    }
  });
});
