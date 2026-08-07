import { useEtlLog } from "@/hooks/bi/useEtlLog";
import type { EtlRunLog } from "@/types/biRpc";

const STATUS_DOT: Record<EtlRunLog["status"], string> = {
  success: "bg-emerald-400",
  error: "bg-red-400",
  running: "bg-yellow-400",
};

const STATUS_LABEL: Record<EtlRunLog["status"], string> = {
  success: "sucesso",
  error: "erro",
  running: "rodando",
};

function formatRunTime(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function truncate(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export function EtlHistoryPanel({ tableName }: { tableName: string }) {
  const { runs, isLoading, error } = useEtlLog(tableName, true);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-champagne-400 border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <p className="px-4 py-4 text-xs text-red-400" role="alert">
        Falha ao carregar histórico: {error.message}
      </p>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="px-4 py-4 text-xs" style={{ color: "var(--voux-text-muted)" }}>
        Sem runs registradas.
      </p>
    );
  }

  return (
    <div
      className="m-3 overflow-hidden rounded-lg border"
      style={{ borderColor: "var(--voux-card-border)", background: "var(--voux-bg)" }}
    >
      <table className="w-full text-xs">
        <thead>
          <tr
            className="text-left uppercase tracking-wider"
            style={{
              fontFamily: "var(--voux-font-label)",
              color: "var(--voux-label)",
              background: "var(--surface-raised)",
            }}
          >
            <th className="px-3 py-2">Horário</th>
            <th className="px-3 py-2">Status</th>
            <th className="px-3 py-2 text-right">Rows</th>
            <th className="px-3 py-2">Erro</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr
              key={`${run.view_name}-${run.started_at}`}
              className="border-t"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <td
                className="px-3 py-2 tabular-nums"
                style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-soft)" }}
              >
                {formatRunTime(run.started_at)}
              </td>
              <td className="px-3 py-2">
                <span className="inline-flex items-center gap-1.5" style={{ color: "var(--voux-text-soft)" }}>
                  <span className={`h-2 w-2 rounded-full ${STATUS_DOT[run.status]}`} aria-hidden />
                  {STATUS_LABEL[run.status]}
                </span>
              </td>
              <td
                className="px-3 py-2 text-right tabular-nums"
                style={{ color: "var(--voux-text-soft)" }}
              >
                {run.rows_affected?.toLocaleString("pt-BR") ?? "—"}
              </td>
              <td className="px-3 py-2">
                {run.error_message ? (
                  <span className="text-red-400" title={run.error_message}>
                    {truncate(run.error_message, 40)}
                  </span>
                ) : (
                  <span style={{ color: "var(--voux-text-muted)" }}>—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
