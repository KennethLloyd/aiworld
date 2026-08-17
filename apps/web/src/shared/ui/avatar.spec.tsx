import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './avatar';

describe('Avatar', () => {
  it('renders the shared fallback when no avatar URL is supplied', () => {
    render(<Avatar alt="Mystic Aura" name="Mystic Aura" />);

    expect(screen.getByTestId('avatar-fallback')).toHaveAttribute(
      'aria-label',
      'Mystic Aura avatar',
    );
    expect(screen.getByText('MA')).toBeInTheDocument();
  });

  it('falls back when the remote image cannot load', () => {
    render(
      <Avatar
        src="https://example.test/avatar.png"
        alt="Mystic Aura"
        name="Mystic Aura"
      />,
    );

    fireEvent.error(screen.getByAltText(''));

    expect(screen.getByTestId('avatar-fallback')).toBeInTheDocument();
  });
});
