import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
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
