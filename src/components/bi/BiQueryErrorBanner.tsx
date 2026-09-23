import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { getBiQueryLabel } from "@/lib/bi/queryLabels";

/** Persistent warning for failed, currently observed BI queries. */
export function BiQueryErrorBanner() {
  const queryClient = useQueryClient();
  const [, setRevision] = useState(0);

  useEffect(() => queryClient.getQueryCache().subscribe(() => {
    setRevision((current) => current + 1);
  }), [queryClient]);

  const failedQueries = queryClient
    .getQueryCache()
    .getAll()
    .filter((query) => (
      query.getObserversCount() > 0
      && query.state.status === "error"
    ));

  const failedSources = [...new Set(failedQueries.map((query) => getBiQueryLabel(query.queryKey)))];

  if (failedQueries.length === 0) return null;

  const retry = () => {
    const failedHashes = new Set(failedQueries.map((query) => query.queryHash));
    void queryClient.refetchQueries({
      type: "active",
      predicate: (query) => failedHashes.has(query.queryHash),
    });
  };

  return (
    <div
      role="alert"
      className="mx-8 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3"
    >
      <div className="flex items-start gap-2 text-sm text-[var(--voux-text-primary)]">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" aria-hidden="true" />
        <p>
          <strong>Dados incompletos.</strong>{" "}
          {failedQueries.length === 1 ? "Uma consulta falhou" : `${failedQueries.length} consultas falharam`}.
          Os campos vazios não significam zero.
          <span className="mt-1 block text-xs text-[var(--voux-text-muted)]">
            Fontes: {failedSources.join(", ")}.
          </span>
        </p>
      </div>
      <Button variant="outline" size="sm" onClick={retry} className="h-8 gap-1.5">
        <RefreshCw className="h-3.5 w-3.5" />
        Tentar novamente
      </Button>
    </div>
  );
}
