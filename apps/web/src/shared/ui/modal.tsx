import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

import { FocusTrap } from '@/shared/accessibility/focus-trap';
import { cn } from '@/shared/ui/cn';

const openModalStack: HTMLDivElement[] = [];
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Custom focus management uses a div dialog. */

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Wide layout for data-dense administrative dialogs. */
  size?: 'default' | 'wide';
}

/**
 * Accessible modal: focus trap + Escape-to-close + focus restore on close +
 * body scroll lock + role="dialog"/aria-modal. Rendered through a portal so
 * fixed positioning is never clipped by an ancestor.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  className,
  size = 'default',
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) {
      return;
    }
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    openModalStack.push(dialog);
    previouslyFocused.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && openModalStack.at(-1) === dialog) {
        event.preventDefault();
        onCloseRef.current();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      const stackIndex = openModalStack.lastIndexOf(dialog);
      if (stackIndex >= 0) {
        openModalStack.splice(stackIndex, 1);
      }
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      if (previouslyFocused.current?.isConnected) {
        previouslyFocused.current.focus();
      }
    };
  }, [open]);

  if (!open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <button
        type="button"
        aria-label="Close dialog"
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm focus:outline-none"
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'glass-panel relative z-10 w-full p-6 outline-none',
          size === 'wide' ? 'admin-modal max-w-6xl' : 'max-w-lg',
          className,
        )}
      >
        <FocusTrap containerRef={dialogRef}>
          <div className="flex items-start justify-between gap-4">
            <h2 id={titleId} className="font-display text-lg font-semibold">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="shrink-0 rounded-lg p-1.5 text-ink/60 transition-colors hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-4">{children}</div>
          {footer ? (
            <div className="mt-6 flex justify-end gap-3">{footer}</div>
          ) : null}
        </FocusTrap>
      </div>
    </div>,
    document.body,
  );
}
