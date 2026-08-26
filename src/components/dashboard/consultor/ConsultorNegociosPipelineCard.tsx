import { memo, useState, useMemo } from "react";
import { Briefcase, Package, MessageSquare, MapPin, Search } from "lucide-react";
import { useConsultorNegociosPipeline } from "@/hooks/useConsultoresRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  consultor: string;
}

const BRL_EXACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return BRL_EXACT.format(Number(value));
}

function getEtapaBadge(etapa: string) {
  const upper = etapa.toUpperCase();
  if (upper.includes("1-") || upper.includes("OPORTUNIDADE")) {
    return { label: "1. Oportunidade", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
  if (upper.includes("2-") || upper.includes("COTACAO") || upper.includes("COTAÇÃO")) {
    return { label: "2. Cotação", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
  }
  if (upper.includes("3-") || upper.includes("PROPOSTA")) {
    return { label: "3. Proposta", bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
  }
  return { label: etapa, bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
}

export const ConsultorNegociosPipelineCard = memo(function ConsultorNegociosPipelineCard({ consultor }: Props) {
  const [etapaFiltro, setEtapaFiltro] = useState<string>("TODOS");
  const [busca, setBusca] = useState<string>("");

  const { data: negocios, isLoading } = useConsultorNegociosPipeline({
    consultor,
    enabled: !!consultor,
  });

  const totalValorGeral = useMemo(
    () => (negocios ?? []).reduce((sum, n) => sum + Number(n.valor || 0), 0),
    [negocios]
  );

  const contagensEtapa = useMemo(() => {
    let oport = 0;
    let cot = 0;
    let prop = 0;
    for (const n of negocios ?? []) {
      const u = n.etapa.toUpperCase();
      if (u.includes("1-") || u.includes("OPORTUNIDADE")) oport++;
      else if (u.includes("2-") || u.includes("COTACAO") || u.includes("COTAÇÃO")) cot++;
      else if (u.includes("3-") || u.includes("PROPOSTA")) prop++;
    }
    return { oport, cot, prop, total: negocios?.length ?? 0 };
  }, [negocios]);

  const negociosFiltrados = useMemo(() => {
    return (negocios ?? []).filter((n) => {
      if (busca.trim()) {
        const q = busca.toLowerCase();
        const matchCliente = n.cliente?.toLowerCase().includes(q);
        const matchProduto = n.produto?.toLowerCase().includes(q);
        const matchObs = n.observacao?.toLowerCase().includes(q);
        const matchCidade = n.cidade?.toLowerCase().includes(q);
        if (!matchCliente && !matchProduto && !matchObs && !matchCidade) return false;
      }

      if (etapaFiltro === "TODOS") return true;
      const u = n.etapa.toUpperCase();
      if (etapaFiltro === "OPORTUNIDADE") return u.includes("1-") || u.includes("OPORTUNIDADE");
      if (etapaFiltro === "COTACAO") return u.includes("2-") || u.includes("COTACAO") || u.includes("COTAÇÃO");
      if (etapaFiltro === "PROPOSTA") return u.includes("3-") || u.includes("PROPOSTA");
      return true;
    });
  }, [negocios, etapaFiltro, busca]);

  const totalValorFiltrado = useMemo(
    () => negociosFiltrados.reduce((sum, n) => sum + Number(n.valor || 0), 0),
    [negociosFiltrados]
  );

  if (isLoading) {
    return (
      <div
        className="rounded-2xl border p-5 space-y-3 h-full flex flex-col justify-between"
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div className="flex justify-between items-center">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-16" />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col justify-between h-full transition-all"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <div>
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3 pb-2.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
              <Briefcase className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--voux-font-sans)" }}>
                Negócios no Pipeline Ativo
              </h3>
              <p className="text-[10px] font-mono text-muted-foreground">
                Oportunidades, Cotações e Propostas reais em andamento
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-background">
              {contagensEtapa.total} negócios abertos
            </span>
          </div>
        </div>

        {/* Filtros de Etapa em Abas Rápidas */}
        <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1">
          {[
            { id: "TODOS", label: `Todos (${contagensEtapa.total})` },
            { id: "OPORTUNIDADE", label: `1. Oport (${contagensEtapa.oport})` },
            { id: "COTACAO", label: `2. Cotaç (${contagensEtapa.cot})` },
            { id: "PROPOSTA", label: `3. Prop (${contagensEtapa.prop})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setEtapaFiltro(tab.id)}
              className={cn(
                "rounded-lg px-2 py-1 text-[10px] font-mono font-medium transition-all shrink-0",
                etapaFiltro === tab.id
                  ? "bg-amber-500 text-amber-950 font-bold shadow-sm"
                  : "border bg-black/[0.02] dark:bg-white/[0.02] text-muted-foreground hover:text-foreground"
              )}
              style={{
                borderColor: etapaFiltro === tab.id ? "transparent" : "var(--voux-card-border)",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Lista de Negócios Reais do Pipeline */}
        {negociosFiltrados.length === 0 ? (
          <div className="py-10 text-center text-xs text-muted-foreground">
            Nenhum negócio encontrado nesta etapa do pipeline.
          </div>
        ) : (
          <div className="space-y-2 max-h-[340px] overflow-y-auto pr-1">
            {negociosFiltrados.map((n) => {
              const badge = getEtapaBadge(n.etapa);
              return (
                <div
                  key={n.numero}
                  className="rounded-xl border p-3 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                  style={{ borderColor: "var(--voux-card-border)" }}
                >
                  {/* Linha 1: Cliente e Valor */}
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-bold text-foreground truncate" title={n.cliente}>
                        {n.cliente}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[13px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatBRL(n.valor)}
                      </p>
                    </div>
                  </div>

                  {/* Linha 2: Badge de Etapa e Produto */}
                  <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border", badge.bg)}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] font-mono text-foreground font-medium truncate flex items-center gap-1">
                      <Package className="h-3 w-3 text-amber-500 shrink-0" />
                      {n.produto}
                    </span>
                  </div>

                  {/* Linha 3: Observações Detalhadas */}
                  {n.observacao && (
                    <div className="text-[10px] text-muted-foreground bg-black/[0.02] dark:bg-white/[0.03] rounded-lg p-2 leading-relaxed flex items-start gap-1.5 border border-black/5 dark:border-white/5">
                      <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <span className="line-clamp-3">{n.observacao}</span>
                    </div>
                  )}

                  {/* Linha 4: Cidade / Praça e Número */}
                  <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-muted-foreground" />
                      {n.cidade || "Praça principal"}
                    </span>
                    <span>Registro #{n.numero}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer com Totalizador da Etapa Selecionada */}
      <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
        <span className="text-muted-foreground">Total {etapaFiltro === "TODOS" ? "em Aberto" : "na Etapa"}:</span>
        <span className="font-bold text-foreground text-[13px] tabular-nums">{formatBRL(totalValorFiltrado)}</span>
      </div>
    </div>
  );
});
