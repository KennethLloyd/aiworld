import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';

import { Modal } from './modal';

describe('Modal', () => {
  it('has no accessibility violations when open', async () => {
    render(
      <Modal open onClose={() => {}} title="Delete world">
        <button type="button">Confirm</button>
      </Modal>,
    );

    expect((await axe(document.body)).violations).toEqual([]);
  });

  it('renders a labelled dialog with aria-modal', () => {
    render(
      <Modal open onClose={() => {}} title="Delete world">
        <button type="button">Confirm</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete world' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    render(
      <Modal open={false} onClose={() => {}} title="Delete world">
        <button type="button">Confirm</button>
      </Modal>,
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn<() => void>();
    render(
      <Modal open onClose={onClose} title="Delete world">
        <button type="button">Confirm</button>
      </Modal>,
    );

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('locks body scroll while open and restores it on close', () => {
    const { unmount } = render(
      <Modal open onClose={() => {}} title="Delete world">
        <button type="button">Confirm</button>
      </Modal>,
    );

    expect(document.body.style.overflow).toBe('hidden');

    unmount();
    expect(document.body.style.overflow).toBe('');
  });

  it('restores focus to the previously focused element on close', () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          {open ? (
            <Modal open onClose={() => setOpen(false)} title="Delete world">
              <button type="button">Confirm</button>
            </Modal>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();

    fireEvent.click(opener);
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('cycles focus with Tab while the trap is active', async () => {
    const user = userEvent.setup();
    render(
      <Modal open onClose={() => {}} title="Delete world">
        <button type="button">First</button>
        <button type="button">Second</button>
      </Modal>,
    );

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    // The close button inside the dialog is the trap's first focusable (the
    // full-screen backdrop button is a sibling, outside the trap).
    const closeButtons = screen.getAllByRole('button', {
      name: 'Close dialog',
    });
    const closeButton = closeButtons[closeButtons.length - 1];

    closeButton.focus();
    await user.tab();
    expect(first).toHaveFocus();

    await user.tab();
    expect(second).toHaveFocus();

    // Wrapping: Tab from the last focusable cycles back to the first.
    await user.tab();
    expect(closeButton).toHaveFocus();

    // Shift+Tab from the first focusable wraps to the last.
    await user.tab({ shift: true });
    expect(second).toHaveFocus();
  });
});
