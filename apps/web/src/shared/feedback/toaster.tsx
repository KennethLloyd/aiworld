import {
  CircleAlert,
  CircleCheck,
  Info,
  X,
  type LucideIcon,
} from 'lucide-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { cn } from '@/shared/ui/cn';

export type ToastTone = 'success' | 'error' | 'info';
export type ToastVariant = 'status' | 'alert';

export interface ToastInput {
  tone: ToastTone;
  title: string;
  description?: string;
  variant?: ToastVariant;
}

export interface Toast extends ToastInput {
  id: string;
}

export interface ToastContextValue {
  toast: (input: ToastInput) => void;
  dismiss: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 5000;
const MAX_TOASTS = 4;
let nextToastId = 0;

const toneIcons: Record<ToastTone, LucideIcon> = {
  success: CircleCheck,
  error: CircleAlert,
  info: Info,
};

const toneTextClasses: Record<ToastTone, string> = {
  success: 'text-brand-diplomat',
  error: 'text-rose-400',
  info: 'text-brand-sentinel',
};

/**
 * Hand-rolled toast host + context (no third-party toast library). Mounted
 * once in the root layout; consumers call useToast(). Toasts auto-dismiss and
 * pause on hover/focus; error toasts use role="alert", everything else
 * role="status". Escape dismisses the most recent toast.
 */
export function Toaster({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
    }
    timers.current.delete(id);
    setToasts((previous) => {
      const next = previous.filter((item) => item.id !== id);
      toastsRef.current = next;
      return next;
    });
  }, []);

  const pause = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const resume = useCallback(
    (id: string) => {
      if (timers.current.has(id)) {
        return;
      }
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
      timers.current.set(id, timer);
    },
    [dismiss],
  );

  const toast = useCallback(
    (input: ToastInput) => {
      const variant =
        input.variant ?? (input.tone === 'error' ? 'alert' : 'status');
      const existing = toastsRef.current.find(
        (item) =>
          item.tone === input.tone &&
          item.title === input.title &&
          item.description === input.description &&
          item.variant === variant,
      );
      const id = existing?.id ?? `toast-${nextToastId++}`;
      const nextToast: Toast = { ...input, variant, id };
      const nextToasts = existing
        ? toastsRef.current.map((item) => (item.id === id ? nextToast : item))
        : [...toastsRef.current.slice(-(MAX_TOASTS - 1)), nextToast];

      toastsRef.current = nextToasts;
      setToasts(nextToasts);
      const timer = timers.current.get(id);
      if (timer !== undefined) {
        clearTimeout(timer);
        timers.current.delete(id);
      }
      resume(id);
    },
    [resume],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && toasts.length > 0) {
        dismiss(toasts[toasts.length - 1].id);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [dismiss, toasts]);

  // Clear any pending timers on unmount.
  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) {
        clearTimeout(timer);
      }
    };
  }, []);

  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <section
        aria-label="Notifications"
        className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-full max-w-sm flex-col gap-3 px-4 sm:px-0"
      >
        {toasts.map((item) => (
          <ToastCard
            key={item.id}
            toast={item}
            onDismiss={dismiss}
            onPause={pause}
            onResume={resume}
          />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

interface ToastCardProps {
  toast: Toast;
  onDismiss: (id: string) => void;
  onPause: (id: string) => void;
  onResume: (id: string) => void;
}

function ToastCard({ toast, onDismiss, onPause, onResume }: ToastCardProps) {
  const Icon = toneIcons[toast.tone];
  return (
    <div
      role={toast.variant}
      className="glass-panel pointer-events-auto flex items-start gap-3 p-4"
      onMouseEnter={() => onPause(toast.id)}
      onMouseLeave={() => onResume(toast.id)}
      onFocus={() => onPause(toast.id)}
      onBlur={() => onResume(toast.id)}
    >
      <Icon
        className={cn('mt-0.5 h-5 w-5 shrink-0', toneTextClasses[toast.tone])}
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-ink/70">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        aria-label="Dismiss notification"
        className="shrink-0 rounded p-1 text-ink/50 transition-colors hover:bg-glass-20 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-sentinel/60"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) {
    throw new Error('useToast must be used within a Toaster');
  }
  return context;
}
