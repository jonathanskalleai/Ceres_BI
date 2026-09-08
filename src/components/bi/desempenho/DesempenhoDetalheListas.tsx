import { useState, useEffect } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { AcoesPedidosTable } from "@/components/bi/AcoesPedidosTable";
import { AcoesNegociosPerdidosTable } from "@/components/bi/AcoesNegociosPerdidosTable";
import { usePedidosGanhosRpc } from "@/hooks/bi/usePedidosGanhosRpc";
import { useNegociosPerdidosRpc } from "@/hooks/bi/useNegociosPerdidosRpc";
import { cn } from "@/lib/utils";

export type DetalheListTab = "ganhos" | "perdidos";

interface DesempenhoDetalheListasProps {
  from?: string | null;
  to?: string | null;
  vendedor?: string | null;
  cidade?: string | null;
  defaultTab?: DetalheListTab;
  className?: string;
}

export function DesempenhoDetalheListas({
  from,
  to,
  vendedor,
  cidade,
  defaultTab = "ganhos",
  className,
}: DesempenhoDetalheListasProps) {
  const [tab, setTab] = useState<DetalheListTab>(defaultTab);
  const [pedidosPage, setPedidosPage] = useState(1);
  const [perdidosPage, setPerdidosPage] = useState(1);

  // Reseta páginas quando os filtros mudam
  useEffect(() => {
    setPedidosPage(1);
    setPerdidosPage(1);
  }, [from, to, vendedor, cidade]);

  const fromParam = from ?? undefined;
  const toParam = to ?? undefined;
  const vendedorParam = vendedor ?? undefined;
  const cidadeParam = cidade ?? undefined;

  const {
    data: pedidosData,
    isLoading: pedidosLoading,
    error: pedidosError,
  } = usePedidosGanhosRpc({
    from: fromParam,
    to: toParam,
    vendedor: vendedorParam,
    cidade: cidadeParam,
    page: pedidosPage,
    enabled: true,
  });

  const {
    data: perdidosData,
    isLoading: perdidosLoading,
    error: perdidosError,
  } = useNegociosPerdidosRpc({
    from: fromParam,
    to: toParam,
    vendedor: vendedorParam,
    cidade: cidadeParam,
    page: perdidosPage,
    enabled: true,
  });

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header com Eyebrow, Título e Abas de Seleção */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 border-b border-[var(--voux-card-border)]/60 pb-3">
        <div>
          <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)] font-mono">
            DRILL-DOWN ANALÍTICO
          </p>
          <h2
            className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Detalhamento de Pedidos e Negócios
          </h2>
          <p className="text-xs text-[var(--voux-text-muted)] mt-0.5">
            Listagem analítica com todas as informações dos desfechos comerciais no período selecionado.
          </p>
        </div>

        {/* Tab Switcher Pills */}
        <div
          className="inline-flex items-center p-1 rounded-xl bg-[var(--voux-surface)] border border-[var(--voux-card-border)] self-start sm:self-auto shrink-0"
          role="tablist"
          aria-label="Alternar visualização de pedidos ou negócios"
        >
          {/* Aba Ganhos */}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "ganhos"}
            onClick={() => setTab("ganhos")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all",
              tab === "ganhos"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            )}
          >
            <CheckCircle2 className={cn("h-3.5 w-3.5", tab === "ganhos" ? "text-emerald-100" : "text-emerald-600")} />
            <span>Pedidos Ganhos</span>
            {pedidosData?.total !== undefined && (
              <span
                className={cn(
                  "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums",
                  tab === "ganhos"
                    ? "bg-emerald-700/80 text-white"
                    : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
                )}
              >
                {pedidosData.total.toLocaleString("pt-BR")}
              </span>
            )}
          </button>

          {/* Aba Perdidos */}
          <button
            type="button"
            role="tab"
            aria-selected={tab === "perdidos"}
            onClick={() => setTab("perdidos")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all",
              tab === "perdidos"
                ? "bg-red-600 text-white shadow-sm font-bold"
                : "text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            )}
          >
            <XCircle className={cn("h-3.5 w-3.5", tab === "perdidos" ? "text-red-100" : "text-red-600")} />
            <span>Negócios Perdidos</span>
            {perdidosData?.total !== undefined && (
              <span
                className={cn(
                  "ml-0.5 px-1.5 py-0.2 rounded-full text-[10px] font-mono tabular-nums",
                  tab === "perdidos"
                    ? "bg-red-700/80 text-white"
                    : "bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20"
                )}
              >
                {perdidosData.total.toLocaleString("pt-BR")}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tabela Ativa */}
      {tab === "ganhos" ? (
        <AcoesPedidosTable
          rows={pedidosData?.rows ?? []}
          total={pedidosData?.total ?? 0}
          page={pedidosPage}
          onPageChange={setPedidosPage}
          loading={pedidosLoading}
          error={pedidosError}
        />
      ) : (
        <AcoesNegociosPerdidosTable
          rows={perdidosData?.rows ?? []}
          total={perdidosData?.total ?? 0}
          page={perdidosPage}
          onPageChange={setPerdidosPage}
          loading={perdidosLoading}
          error={perdidosError}
        />
      )}
    </div>
  );
}
