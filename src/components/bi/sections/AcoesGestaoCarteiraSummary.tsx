import { Skeleton } from "@/components/ui/skeleton";
import { useAcoesGestaoListasRpc } from "@/hooks/bi/useAcoesGestaoListasRpc";
import { fmtNum } from "@/lib/formatters";
import type { AcoesSemContatoRow } from "@/types/biRpc";

interface Props {
  from?: string;
  to?: string;
  vendedor?: string;
  cidade?: string;
  active?: boolean;
}

/**
 * Mini-cards resumo da gestao da carteira — top 3 clientes sem contato.
 * Renderizado ANTES das abas de gestao, dando ao gestor um relance rapido
 * de quem precisa de atencao imediata sem precisar abrir a lista completa.
 */
export function AcoesGestaoCarteiraSummary({ from, to, vendedor, cidade, active = true }: Props) {
  const { data, isLoading } = useAcoesGestaoListasRpc<AcoesSemContatoRow>({
    tipo: "sem_contato",
    from,
    to,
    vendedor,
    cidade,
    limit: 3,
    enabled: active,
  });

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;

  if (!isLoading && rows.length === 0) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3" aria-label="Resumo: clientes sem contato recente">
      {isLoading
        ? Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-ink-900/50 border border-ink-800/50 rounded-xl px-3 py-2">
              <Skeleton className="h-3 w-24 mb-1.5 rounded" style={{ background: "var(--voux-skeleton)" }} />
              <Skeleton className="h-4 w-16 rounded" style={{ background: "var(--voux-skeleton)" }} />
            </div>
          ))
        : rows.map((row, i) => (
            <div
              key={row.clienteId}
              className="bg-ink-900/50 border border-ink-800/50 rounded-xl px-3 py-2"
            >
              <p className="text-[11px] text-[var(--voux-text-muted)] truncate" title={row.cliente ?? "—"}>
                <span
                  className="mr-1.5 text-[9px] text-[var(--voux-text-faint)]"
                  style={{ fontFamily: "var(--voux-font-mono)" }}
                >
                  {String(i + 1).padStart(2, "0")} ·
                </span>
                {row.cliente ?? "Sem nome"}
              </p>
              <p
                className="text-sm font-semibold tabular-nums text-[var(--voux-champagne-400)]"
                style={{ fontFamily: "var(--voux-font-mono)" }}
              >
                {row.semAcaoNoAno ? "Sem acao no ano" : `${fmtNum(row.dias)} dias`}
              </p>
            </div>
          ))}
      {!isLoading && total > 3 && (
        <p
          className="col-span-full text-[10px] text-[var(--voux-text-faint)] mt-1"
          style={{ fontFamily: "var(--voux-font-mono)", letterSpacing: "0.06em" }}
        >
          + {fmtNum(total - 3)} clientes sem contato recente
        </p>
      )}
    </div>
  );
}
