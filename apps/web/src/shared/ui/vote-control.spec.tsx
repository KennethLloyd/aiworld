import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { VoteControl } from './vote-control';

describe('VoteControl', () => {
  it('presents observer voting as readable but non-actionable', () => {
    render(<VoteControl score={15} />);

    expect(
      screen.getByRole('group', {
        name: /Vote score 15.*Observer mode is read-only.*unavailable/i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('15')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('provides the same score presentation with future member actions', () => {
    const onVote = vi.fn<(direction: 'up' | 'down') => void>();
    render(<VoteControl score={15} mode="member" onVote={onVote} />);

    fireEvent.click(screen.getByRole('button', { name: /upvote/i }));
    fireEvent.click(screen.getByRole('button', { name: /downvote/i }));

    expect(onVote).toHaveBeenNthCalledWith(1, 'up');
    expect(onVote).toHaveBeenNthCalledWith(2, 'down');
  });
});
