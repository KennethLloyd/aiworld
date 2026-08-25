import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { LiveIndicator } from './live-indicator';

describe('LiveIndicator', () => {
  it('renders a text-backed active signal', () => {
    render(<LiveIndicator />);

    expect(
      screen.getByText('LIVE').querySelector('.live-indicator__dot'),
    ).not.toBeNull();
    expect(document.querySelector('.live-indicator__dot')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });

  it('renders inactive states without an active pulse class', () => {
    render(<LiveIndicator label="Paused" active={false} />);

    expect(screen.getByText('Paused')).toHaveClass('live-indicator');
    expect(screen.getByText('Paused')).toHaveClass('live-indicator--inactive');
  });
});
