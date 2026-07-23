import type { AcoesBIRankingItem } from "@/types/biRpc";

interface Props {
  data: AcoesBIRankingItem[];
  loading?: boolean;
}

/**
 * Ranking table: Consultor x Cidade — acoes + visitas.
 * Extracted from AcoesSection for component size discipline (<200 lines).
 */
export function AcoesRankingTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
        <div className="h-4 w-48 bg-foreground/5 animate-pulse rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-6 bg-foreground/5 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--voux-text-muted)] mb-3">
        Ranking Consultor por Cidade
      </h3>
      <div className="max-h-[360px] overflow-y-auto">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-[var(--voux-card-from)]">
            <tr className="border-b border-[var(--voux-card-border)] text-left text-[var(--voux-text-muted)]">
              <th className="pb-2 pr-3 font-medium">Consultor</th>
              <th className="pb-2 pr-3 font-medium">Cidade</th>
              <th className="pb-2 pr-3 font-medium text-right">Acoes</th>
              <th className="pb-2 font-medium text-right">Visitas</th>
            </tr>
          </thead>
          <tbody>
            {data.slice(0, 20).map((row, idx) => (
              <tr
                key={`${row.vendedor}-${row.cidade}`}
                className={idx % 2 === 0 ? "bg-foreground/[0.02]" : ""}
              >
                <td className="py-1.5 pr-3 text-[var(--voux-text-primary)] truncate max-w-[140px]" title={row.vendedor}>
                  {row.vendedor}
                </td>
                <td className="py-1.5 pr-3 text-[var(--voux-text-soft)] truncate max-w-[120px]" title={row.cidade}>
                  {row.cidade}
                </td>
                <td className="py-1.5 pr-3 text-right text-[var(--voux-text-primary)] tabular-nums">
                  {row.acoes.toLocaleString("pt-BR")}
                </td>
                <td className="py-1.5 text-right text-[var(--voux-text-primary)] tabular-nums">
                  {row.visitas.toLocaleString("pt-BR")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
