import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export interface FocusTrapProps {
  active?: boolean;
  className?: string;
  children: ReactNode;
  /** Optional ref to the trap container (used by Modal to focus the dialog). */
  containerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Cycles Tab/Shift+Tab focus within the container while active. The container
 * itself is not focusable; the caller focuses it (e.g. a role="dialog").
 */
export function FocusTrap({
  active = true,
  className,
  children,
  containerRef,
}: FocusTrapProps) {
  const innerRef = useRef<HTMLDivElement>(null);
  const ref = containerRef ?? innerRef;

  useEffect(() => {
    if (!active) {
      return;
    }
    const container = ref.current;
    if (!container) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') {
        return;
      }
      const focusable = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;

      if (event.shiftKey) {
        if (activeElement === first || !container.contains(activeElement)) {
          event.preventDefault();
          last.focus();
        }
      } else if (activeElement === last || !container.contains(activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [active, ref]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
