import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { usePullToRefresh } from './use-pull-to-refresh';

function PullRefreshHarness({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const pull = usePullToRefresh({ onRefresh, threshold: 40 });

  return (
    <div
      data-testid="surface"
      onTouchCancel={pull.onTouchCancel}
      onTouchEnd={pull.onTouchEnd}
      onTouchMove={pull.onTouchMove}
      onTouchStart={pull.onTouchStart}
    >
      <button type="button">Open</button>
      <output data-testid="distance">{pull.pullDistance}</output>
      <output data-testid="refreshing">{String(pull.isRefreshing)}</output>
    </div>
  );
}

describe('usePullToRefresh', () => {
  it('refreshes after a downward gesture at the top of the document', async () => {
    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 0,
    });
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);

    render(<PullRefreshHarness onRefresh={onRefresh} />);
    const surface = screen.getByTestId('surface');

    fireEvent.touchStart(surface, { touches: [{ clientY: 10 }] });
    fireEvent.touchMove(surface, { touches: [{ clientY: 130 }] });
    expect(Number(screen.getByTestId('distance').textContent)).toBeGreaterThan(
      40,
    );

    fireEvent.touchEnd(surface);

    await waitFor(() => expect(onRefresh).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(screen.getByTestId('refreshing')).toHaveTextContent('false'),
    );
  });

  it('ignores gestures that begin on controls or below the top', async () => {
    const onRefresh = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
    render(<PullRefreshHarness onRefresh={onRefresh} />);
    const surface = screen.getByTestId('surface');
    const button = screen.getByRole('button', { name: 'Open' });

    fireEvent.touchStart(button, { touches: [{ clientY: 10 }] });
    fireEvent.touchMove(surface, { touches: [{ clientY: 150 }] });
    fireEvent.touchEnd(surface);

    Object.defineProperty(window, 'scrollY', {
      configurable: true,
      value: 20,
    });
    fireEvent.touchStart(surface, { touches: [{ clientY: 10 }] });
    fireEvent.touchMove(surface, { touches: [{ clientY: 150 }] });
    fireEvent.touchEnd(surface);

    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(onRefresh).not.toHaveBeenCalled();
    expect(screen.getByTestId('distance')).toHaveTextContent('0');
  });
});
