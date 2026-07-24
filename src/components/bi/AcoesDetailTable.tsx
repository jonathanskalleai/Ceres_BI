import type { AcoesBIDetalheItem } from "@/types/biRpc";

interface Props {
  data: AcoesBIDetalheItem[];
  loading?: boolean;
}

/**
 * Tabela "Acoes do Periodo" — detalhamento das 50 acoes mais recentes do periodo filtrado.
 */
export function AcoesDetailTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
        <div className="h-4 w-48 bg-foreground/5 animate-pulse rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 bg-foreground/5 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--voux-text-muted)] mb-3">
        Acoes do Periodo · Ultimas 50
      </h3>
      <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[var(--voux-card-from)] z-10">
            <tr>
              <th className="text-left py-2 pr-2 font-medium text-[var(--voux-text-muted)]">Data</th>
              <th className="text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]">Consultor</th>
              <th className="text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]">Cliente</th>
              <th className="text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]">Cidade</th>
              <th className="text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]">Tipo Acao</th>
              <th className="text-left py-2 pl-2 font-medium text-[var(--voux-text-muted)]">Contato</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={`${row.data}-${row.cliente}-${i}`}
                className={`border-t border-[var(--voux-card-border)]/30 ${i % 2 === 1 ? "bg-foreground/[0.02]" : ""}`}
              >
                <td className="py-2 pr-2 tabular-nums text-[var(--voux-text-primary)] whitespace-nowrap">
                  {row.data}
                </td>
                <td
                  className="py-2 px-2 text-[var(--voux-text-primary)] truncate max-w-[120px]"
                  title={row.consultor ?? ""}
                >
                  {row.consultor ?? "—"}
                </td>
                <td
                  className="py-2 px-2 text-[var(--voux-text-primary)] truncate max-w-[160px]"
                  title={row.cliente ?? ""}
                >
                  {row.cliente ?? "—"}
                </td>
                <td
                  className="py-2 px-2 text-[var(--voux-text-soft)] truncate max-w-[120px]"
                  title={row.cidade ?? ""}
                >
                  {row.cidade ?? "—"}
                </td>
                <td
                  className="py-2 px-2 text-[var(--voux-text-soft)] truncate max-w-[120px]"
                  title={row.tipoAcao ?? ""}
                >
                  {row.tipoAcao ?? "—"}
                </td>
                <td
                  className="py-2 pl-2 text-[var(--voux-text-soft)] truncate max-w-[120px]"
                  title={row.tipoContato ?? ""}
                >
                  {row.tipoContato ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
