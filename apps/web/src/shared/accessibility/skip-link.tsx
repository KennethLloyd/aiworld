/**
 * Keyboard reachable "Skip to main content" link that targets the app shell's
 * <main id="main"> landmark.
 */
export function SkipLink({ href = '#main' }: { href?: string }) {
  return (
    <a
      href={href}
      className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:border focus:border-glass-border focus:bg-surface-2 focus:px-4 focus:py-2 focus:text-ink focus:outline-2 focus:outline-offset-2 focus:outline-brand-sentinel/60"
    >
      Skip to main content
    </a>
  );
}
