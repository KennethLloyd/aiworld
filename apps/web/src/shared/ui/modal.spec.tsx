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

  it('renders a labelled dialog with aria-modal and moves focus into it', () => {
    render(
      <Modal open onClose={() => {}} title="Delete world">
        <button type="button">Confirm</button>
      </Modal>,
    );

    const dialog = screen.getByRole('dialog', { name: 'Delete world' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(dialog).toHaveFocus();
  });
  it('supports a wide layout for data-dense dialogs', () => {
    render(
      <Modal open onClose={() => {}} title="Add Residents" size="wide">
        <button type="button">Assign</button>
      </Modal>,
    );

    expect(screen.getByRole('dialog')).toHaveClass('max-w-6xl');
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

  it('closes only the topmost nested modal on Escape', () => {
    function Harness() {
      const [outerOpen, setOuterOpen] = useState(false);
      const [innerOpen, setInnerOpen] = useState(false);

      return (
        <>
          <button type="button" onClick={() => setOuterOpen(true)}>
            Open outer
          </button>
          {outerOpen ? (
            <Modal open onClose={() => setOuterOpen(false)} title="Outer modal">
              <button type="button" onClick={() => setInnerOpen(true)}>
                Open inner
              </button>
              {innerOpen ? (
                <Modal
                  open
                  onClose={() => setInnerOpen(false)}
                  title="Inner modal"
                >
                  <button type="button">Inner action</button>
                </Modal>
              ) : null}
            </Modal>
          ) : null}
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open outer' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open inner' }));

    expect(screen.getByRole('dialog', { name: 'Outer modal' })).toBeVisible();
    expect(screen.getByRole('dialog', { name: 'Inner modal' })).toBeVisible();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(
      screen.getByRole('dialog', { name: 'Outer modal' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('dialog', { name: 'Inner modal' }),
    ).not.toBeInTheDocument();
  });

  it('keeps form focus when modal content rerenders', async () => {
    const user = userEvent.setup();

    function Harness() {
      const [value, setValue] = useState('');
      return (
        <Modal open onClose={() => {}} title="Edit character">
          <input
            aria-label="Character name"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Modal>
      );
    }

    render(<Harness />);
    const input = screen.getByRole('textbox', { name: 'Character name' });
    input.focus();
    await user.type(input, 'Mystic Aura');

    expect(input).toHaveValue('Mystic Aura');
    expect(input).toHaveFocus();
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
