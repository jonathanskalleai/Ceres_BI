import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

const CHUNK_RELOAD_KEY = "ceresbi:chunk-reload-url";

function isDynamicImportFailure(error: Error): boolean {
  return /failed to fetch dynamically imported module|importing a module script failed|loading chunk/i.test(
    error.message,
  );
}

function reloadOnceForNewBuild(): boolean {
  const currentUrl = window.location.href;
  const markerPrefix = `${currentUrl}|`;
  const previous = window.sessionStorage.getItem(CHUNK_RELOAD_KEY);
  const previousAt = previous?.startsWith(markerPrefix)
    ? Number(previous.slice(markerPrefix.length))
    : Number.NaN;
  if (Number.isFinite(previousAt) && Date.now() - previousAt < 30_000) return false;
  window.sessionStorage.setItem(CHUNK_RELOAD_KEY, `${currentUrl}|${Date.now()}`);
  window.location.reload();
  return true;
}

/**
 * Generic React Error Boundary.
 * Catches render errors in children and shows a friendly fallback UI.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // A deployment replaces Vite's hashed asset names. A tab that still has
    // the old app shell can request a chunk which no longer exists and used to
    // make users click "Tentar novamente" repeatedly. Reload once to acquire
    // the current index/chunk set; the guard prevents an infinite loop for a
    // real network failure.
    if (isDynamicImportFailure(error) && reloadOnceForNewBuild()) return;
    this.props.onError?.(error, errorInfo);
  }

  private handleReload = (): void => {
    window.location.reload();
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    if (this.props.fallback) {
      return this.props.fallback;
    }

    return (
      <div
        className="flex flex-col items-center justify-center gap-4 p-8 text-center"
        style={{ minHeight: '200px' }}
      >
        <p
          className="text-lg font-medium"
          style={{ color: 'var(--voux-ink-200)', fontFamily: 'var(--voux-font-sans)' }}
        >
          Algo deu errado ao carregar esta secao.
        </p>
        <button
          onClick={this.handleReload}
          className="px-5 py-2.5 rounded-full font-medium transition-colors"
          style={{
            background: 'var(--voux-champagne-400)',
            color: 'var(--voux-ink-1000)',
            fontFamily: 'var(--voux-font-sans)',
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }
}
