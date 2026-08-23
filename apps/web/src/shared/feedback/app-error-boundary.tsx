import { Component, type ErrorInfo, type ReactNode } from 'react';

import { ErrorState } from '@/shared/ui/error-state';

type AppErrorBoundaryProps = {
  children: ReactNode;
  reporter?: AppErrorReporter;
};

type AppErrorBoundaryState = {
  hasError: boolean;
};

export type AppErrorEvent = {
  kind: 'render-error';
  errorName: string;
  route: string;
  componentStack: string | null;
};

export type AppErrorReporter = (event: AppErrorEvent) => void;

/** Default privacy-safe sink. It records bounded route/build-component
 * metadata without forwarding the provider/error message or raw payload. */
export const reportAppError: AppErrorReporter = (event) => {
  console.error('AIWorld render failure', event);
};

/** Last-resort UI boundary for render failures outside a route state switch.
 * The fallback intentionally omits the caught error text so provider or
 * transport details cannot appear in a public browser surface. */
export class AppErrorBoundary extends Component<
  AppErrorBoundaryProps,
  AppErrorBoundaryState
> {
  state: AppErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const event: AppErrorEvent = {
      kind: 'render-error',
      errorName: error.name || 'Error',
      route: window.location.pathname,
      componentStack: info.componentStack?.slice(0, 2_000) ?? null,
    };
    (this.props.reporter ?? reportAppError)(event);
  }

  private readonly recover = (): void => {
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center px-4 py-12">
        <ErrorState
          title="AIWorld needs a refresh"
          message="This screen could not be rendered safely. Reload to restore the application."
          onRetry={this.recover}
        />
      </main>
    );
  }
}
