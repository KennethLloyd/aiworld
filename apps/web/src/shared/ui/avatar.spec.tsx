import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { Avatar } from './avatar';
import { identityAccent } from './identity-accent';

describe('Avatar', () => {
  it('renders the shared fallback when no avatar URL is supplied', () => {
    render(
      <Avatar
        alt="Mystic Aura"
        name="Mystic Aura"
        identityId="7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11"
      />,
    );

    expect(screen.getByTestId('avatar-fallback')).toHaveAttribute(
      'aria-label',
      'Mystic Aura avatar',
    );
    expect(screen.getByTestId('avatar-fallback')).toHaveAttribute(
      'data-identity-accent',
      identityAccent('7a3f6f47-9a5c-4a0a-bc4d-1c0d9d3b2f11'),
    );
    expect(screen.getByTestId('avatar-fallback')).toHaveAttribute(
      'data-testid',
      'avatar-fallback',
    );
    expect(
      screen.getByTestId('avatar-fallback').querySelector('[data-glyph]'),
    ).toBeInTheDocument();
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

  it('retries the preview when the avatar URL changes', () => {
    const { rerender } = render(
      <Avatar
        src="https://example.test/broken.png"
        alt="Mystic Aura"
        name="Mystic Aura"
      />,
    );

    fireEvent.error(screen.getByAltText(''));
    rerender(
      <Avatar
        src="https://example.test/working.png"
        alt="Mystic Aura"
        name="Mystic Aura"
      />,
    );

    expect(screen.getByTestId('avatar-image')).toBeInTheDocument();
  });
});
