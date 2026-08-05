/**
 * Visually hidden but still available to assistive technology and the focus
 * ring (sr-only from Tailwind).
 */
export function VisuallyHidden({ children }: { children: string }) {
  return <span className="sr-only">{children}</span>;
}
