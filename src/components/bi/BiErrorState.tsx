import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BiErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

/**
 * Reusable error state for BI sections.
 * Shows a user-friendly error with optional retry action.
 */
export function BiErrorState({
  message = "Erro ao carregar dados",
  onRetry,
}: BiErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <div
        className="w-12 h-12 rounded-full flex items-center justify-center"
        style={{ background: "rgba(201,117,101,0.12)" }}
      >
        <AlertTriangle className="h-5 w-5" style={{ color: "var(--voux-danger)" }} />
      </div>
      <p className="text-sm" style={{ color: "var(--voux-text-muted)" }}>
        {message}
      </p>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="gap-1.5 text-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
