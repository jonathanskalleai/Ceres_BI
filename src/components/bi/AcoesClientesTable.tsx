import type { AcoesBIClienteItem } from "@/types/biRpc";

interface Props {
  data: AcoesBIClienteItem[];
  loading?: boolean;
}

/**
 * Tabela "Clientes Mais Atendidos (Ano)" — top 15 clientes por volume de ações no ano atual.
 */
export function AcoesClientesTable({ data, loading }: Props) {
  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
        <div className="h-4 w-56 bg-foreground/5 animate-pulse rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
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
        Clientes Mais Atendidos · Ano Atual
      </h3>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 font-medium text-[var(--voux-text-muted)]">Cliente</th>
              <th className="text-left py-2 px-3 font-medium text-[var(--voux-text-muted)]">Cidade</th>
              <th className="text-right py-2 px-3 font-medium text-[var(--voux-text-muted)]">Acoes</th>
              <th className="text-right py-2 pl-3 font-medium text-[var(--voux-text-muted)]">Visitas</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={`${row.cliente}-${row.cidade}`}
                className={`border-t border-[var(--voux-card-border)]/30 ${i % 2 === 1 ? "bg-foreground/[0.02]" : ""}`}
              >
                <td
                  className="py-2 pr-3 text-[var(--voux-text-primary)] truncate max-w-[200px]"
                  title={row.cliente}
                >
                  {row.cliente}
                </td>
                <td
                  className="py-2 px-3 text-[var(--voux-text-soft)] truncate max-w-[140px]"
                  title={row.cidade ?? ""}
                >
                  {row.cidade ?? "—"}
                </td>
                <td className="py-2 px-3 text-right tabular-nums text-[var(--voux-text-primary)]">
                  {row.acoes.toLocaleString("pt-BR")}
                </td>
                <td className="py-2 pl-3 text-right tabular-nums text-[var(--voux-text-soft)]">
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
