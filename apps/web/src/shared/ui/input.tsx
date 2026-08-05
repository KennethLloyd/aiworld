import { useId, type InputHTMLAttributes } from 'react';

import { cn } from './cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Error text; renders with aria-invalid and a described-by link. */
  error?: string;
  hint?: string;
}

export function Input({
  label,
  error,
  hint,
  id,
  className,
  ...props
}: InputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint && !error ? `${inputId}-hint` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label
          htmlFor={inputId}
          className="text-xs font-medium uppercase tracking-wider text-ink/60"
        >
          {label}
        </label>
      ) : null}
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : hintId}
        className={cn(
          'h-11 w-full rounded-lg border bg-surface-2 px-3.5 text-sm text-ink transition-colors',
          'placeholder:text-ink/40 focus:outline-none focus:ring-2',
          error
            ? 'border-rose-500/50 focus:ring-rose-500/40'
            : 'border-glass-border focus:border-brand-sentinel/50 focus:ring-brand-sentinel/40',
          className,
        )}
        {...props}
      />
      {error ? (
        <p id={errorId} role="alert" className="text-xs text-rose-400">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs text-ink/50">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
