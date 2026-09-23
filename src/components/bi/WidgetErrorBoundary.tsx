import { useCallback, useState, type ErrorInfo, type ReactNode } from "react";
import { RefreshCw, TriangleAlert } from "lucide-react";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { reportClientError } from "@/lib/logger";

interface WidgetErrorBoundaryProps {
  children: ReactNode;
  /** Nome curto usado no fallback e no evento de observabilidade. */
  widgetName?: string;
  className?: string;
}
function WidgetFallback({ name, onRetry, className }: { name: string; onRetry: () => void; className?: string }) {
  return (
    <div
      role="alert"
      className={`flex min-h-[120px] flex-col items-center justify-center gap-3 rounded-xl border border-[var(--voux-card-border)] p-5 text-center ${className ?? ""}`}
    >
      <TriangleAlert className="h-5 w-5 text-[var(--voux-danger)]" aria-hidden="true" />
      <p className="text-xs text-[var(--voux-text-muted)]">
        Não foi possível renderizar {name}. Os demais blocos continuam disponíveis.
      </p>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--voux-card-border)] px-3 py-1.5 text-xs font-medium text-[var(--voux-text-primary)] transition-colors hover:bg-foreground/[0.05]"
      >
        <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
        Tentar novamente
      </button>
    </div>
  );
}

/**
 * Boundary local para um card/widget. Um erro de shape, NaN ou biblioteca de
 * gráficos não pode desmontar a rota inteira; o usuário pode repetir somente
 * aquele bloco sem recarregar a sessão.
 */
export function WidgetErrorBoundary({ children, widgetName = "este bloco", className }: WidgetErrorBoundaryProps) {
  const [retryKey, setRetryKey] = useState(0);
  const retry = useCallback(() => setRetryKey((key) => key + 1), []);
  const onError = useCallback(
    (error: Error, errorInfo: ErrorInfo) => {
      reportClientError("bi.widget_render_error", error, {
        widget: widgetName,
        component_stack: errorInfo.componentStack?.slice(0, 1_000),
      });
    },
    [widgetName],
  );

  return (
    <ErrorBoundary
      key={retryKey}
      onError={onError}
      fallback={<WidgetFallback name={widgetName} onRetry={retry} className={className} />}
    >
      {children}
    </ErrorBoundary>
  );
}
