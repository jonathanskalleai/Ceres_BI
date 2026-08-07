import { BiTableCard } from "@/components/bi/BiTableCard";
import type { AcoesBIClienteItem } from "@/types/biRpc";

interface Props {
  data: AcoesBIClienteItem[];
  loading?: boolean;
  error?: Error | null;
}

/**
 * Tabela "Clientes Mais Atendidos (Ano)" — top 15 clientes por volume de ações no ano atual.
 */
export function AcoesClientesTable({ data, loading, error }: Props) {
  return (
    <BiTableCard
      title="Clientes Mais Atendidos · Ano Atual"
      loading={loading}
      error={error}
      isEmpty={data.length === 0}
      skeletonRows={5}
    >
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
    </BiTableCard>
  );
}
