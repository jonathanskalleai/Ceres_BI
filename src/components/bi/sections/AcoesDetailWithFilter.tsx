import { useState } from "react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { AcoesDetailTable } from "@/components/bi/AcoesDetailTable";
import { AcoesPedidosTable } from "@/components/bi/AcoesPedidosTable";
import { AcoesNegociosPerdidosTable } from "@/components/bi/AcoesNegociosPerdidosTable";
import { AcoesEmAndamentoTable } from "@/components/bi/AcoesEmAndamentoTable";
import { usePedidosGanhosRpc } from "@/hooks/bi/usePedidosGanhosRpc";
import { useNegociosPerdidosRpc } from "@/hooks/bi/useNegociosPerdidosRpc";
import { useEmAndamentoRpc } from "@/hooks/bi/useEmAndamentoRpc";
import type { AcoesDetalheItem } from "@/types/biRpc";

/** Story 5-A: "Em Aberto" renomeado para "Em Andamento". */
const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "Em Andamento", label: "Em Andamento" },
  { value: "Ganho", label: "Ganho" },
  { value: "Perdido", label: "Perdido" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  "": "border-[var(--voux-card-border)] text-[var(--voux-text-primary)]",
  "Em Andamento": "border-[var(--voux-champagne-400)] text-[var(--voux-champagne-400)]",
  "Ganho": "border-[#1f6e3f] text-[#1f6e3f]",
  "Perdido": "border-[#b8421c] text-[#b8421c]",
};

interface LegacyProps {
  rows: AcoesDetalheItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  error?: Error | null;
}

/**
 * Roteador por statusNegocio (Story 4-A/4-B/5-A).
 *
 * Cada status renderiza a tabela correta:
 *   "" (Todos)       → AcoesDetailTable  (legacy, unchanged)
 *   "Em Andamento"   → AcoesEmAndamentoTable
 *   "Ganho"          → AcoesPedidosTable
 *   "Perdido"        → AcoesNegociosPerdidosTable
 *
 * As 3 tabelas novas gerenciam sua própria paginação internamente.
 * O chip "Em Aberto" foi renomeado para "Em Andamento" (Story 5-A).
 */
export function AcoesDetailWithFilter({ rows, total, page, pageSize, totalPages, onPageChange, loading, error }: LegacyProps) {
  const { statusNegocio, setStatusNegocio, vendedor, cidade } = useNegociosFilter();

  // Paginação interna de cada tabela drill-down
  const [pedidosPage, setPedidosPage] = useState(1);
  const [perdidosPage, setPerdidosPage] = useState(1);
  const [andamentoPage, setAndamentoPage] = useState(1);

  // Reset para página 1 ao trocar filtros que afetam todas as tabelas
  // (a troca de statusNegocio já acontece no chip, não precisa de reset aqui)

  const { data: pedidosData, isLoading: pedidosLoading, error: pedidosError } = usePedidosGanhosRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    page: pedidosPage,
    enabled: statusNegocio === "Ganho",
  });

  const { data: negociosPerdidosData, isLoading: negociosPerdidosLoading, error: negociosPerdidosError } = useNegociosPerdidosRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    page: perdidosPage,
    enabled: statusNegocio === "Perdido",
  });

  const { data: emAndamentoData, isLoading: emAndamentoLoading, error: emAndamentoError } = useEmAndamentoRpc({
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    page: andamentoPage,
    enabled: statusNegocio === "Em Andamento",
  });

  return (
    <div className="space-y-3">
      {/* Status filter chips + total badge */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por status do negocio">
        <span className="text-xs text-[var(--voux-text-muted)] mr-1">Status:</span>
        {STATUS_OPTIONS.map(({ value, label }) => {
          const active = statusNegocio === value;
          const colorClass = STATUS_COLORS[value] ?? STATUS_COLORS[""];
          return (
            <button
              key={value}
              type="button"
              onClick={() => {
                setStatusNegocio(value);
                // Reset pages for drill-down tables when switching away from them
                if (value !== "Ganho") setPedidosPage(1);
                if (value !== "Perdido") setPerdidosPage(1);
                if (value !== "Em Andamento") setAndamentoPage(1);
              }}
              aria-pressed={active}
              className={`h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)] ${colorClass} ${
                active ? "bg-foreground/10" : "bg-transparent hover:bg-foreground/5"
              }`}
            >
              {label}
            </button>
          );
        })}

        {/* Total badge when filter is active */}
        {statusNegocio && total > 0 && (
          <span className="ml-2 inline-flex items-center h-6 rounded-full bg-foreground/5 border border-[var(--voux-card-border)] px-2.5 text-[11px] font-mono tabular-nums text-[var(--voux-text-soft)]">
            {total.toLocaleString("pt-BR")} resultados
          </span>
        )}
      </div>

      {/* Info badge when status filter active */}
      {statusNegocio && (
        <p className="text-[11px] text-[var(--voux-text-muted)] italic">
          Filtrando por status: {statusNegocio} — acoes sem negocio vinculado nao sao exibidas
        </p>
      )}

      {/* Routed table */}
      {statusNegocio === "Ganho" && (
        <AcoesPedidosTable
          rows={pedidosData?.rows ?? []}
          total={pedidosData?.total ?? 0}
          page={pedidosPage}
          onPageChange={setPedidosPage}
          loading={pedidosLoading}
          error={pedidosError}
        />
      )}
      {statusNegocio === "Perdido" && (
        <AcoesNegociosPerdidosTable
          rows={negociosPerdidosData?.rows ?? []}
          total={negociosPerdidosData?.total ?? 0}
          page={perdidosPage}
          onPageChange={setPerdidosPage}
          loading={negociosPerdidosLoading}
          error={negociosPerdidosError}
        />
      )}
      {statusNegocio === "Em Andamento" && (
        <AcoesEmAndamentoTable
          rows={emAndamentoData?.rows ?? []}
          total={emAndamentoData?.total ?? 0}
          page={andamentoPage}
          onPageChange={setAndamentoPage}
          loading={emAndamentoLoading}
          error={emAndamentoError}
        />
      )}
      {statusNegocio === "" && (
        <AcoesDetailTable
          rows={rows}
          total={total}
          page={page}
          pageSize={pageSize}
          totalPages={totalPages}
          onPageChange={onPageChange}
          loading={loading}
          error={error}
        />
      )}
    </div>
  );
}
