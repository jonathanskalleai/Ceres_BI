import { memo, useState, useMemo } from "react";
import { Briefcase, Package, MessageSquare, MapPin, Flame, ArrowUpDown, ChevronRight, Info } from "lucide-react";
import { useConsultorNegociosPipeline } from "@/hooks/useConsultoresRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { ConsultorNegocioDetailModal } from "./ConsultorNegocioDetailModal";
import type { RpcConsultorNegocioPipeline } from "@/types/consultoresRpc";
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
  const upper = (etapa || "").toUpperCase();
  if (upper.includes("1-") || upper.includes("OPORTUNIDADE")) {
    return { label: "1. Oportunidade", bg: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" };
  }
  if (upper.includes("2-") || upper.includes("COTACAO") || upper.includes("COTAÇÃO")) {
    return { label: "2. Cotação", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" };
  }
  if (upper.includes("3-") || upper.includes("PROPOSTA")) {
    return { label: "3. Proposta", bg: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20" };
  }
  return { label: etapa || "Vendas", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" };
}

function getTermometroBadge(estrelas: number) {
  const count = Math.min(Math.max(estrelas || 0, 0), 5);
  switch (count) {
    case 5:
      return {
        label: "5★ Quentíssimo",
        color: "text-amber-400",
        bg: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30",
        stars: "★★★★★",
      };
    case 4:
      return {
        label: "4★ Alta Prob.",
        color: "text-emerald-500",
        bg: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
        stars: "★★★★☆",
      };
    case 3:
      return {
        label: "3★ Morno",
        color: "text-amber-500",
        bg: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30",
        stars: "★★★☆☆",
      };
    case 2:
      return {
        label: "2★ Frio",
        color: "text-sky-500",
        bg: "bg-sky-500/15 text-sky-600 dark:text-sky-400 border-sky-500/30",
        stars: "★★☆☆☆",
      };
    case 1:
      return {
        label: "1★ Inicial",
        color: "text-rose-500",
        bg: "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30",
        stars: "★☆☆☆☆",
      };
    default:
      return {
        label: "0★ Neutro",
        color: "text-muted-foreground",
        bg: "bg-black/[0.03] dark:bg-white/[0.03] text-muted-foreground border-border/50",
        stars: "☆☆☆☆☆",
      };
  }
}

type OrdenacaoTipo = "estrelas" | "valor" | "recentes";

export const ConsultorNegociosPipelineCard = memo(function ConsultorNegociosPipelineCard({ consultor }: Props) {
  const [etapaFiltro, setEtapaFiltro] = useState<string>("TODOS");
  const [ordenacao, setOrdenacao] = useState<OrdenacaoTipo>("estrelas");
  const [selectedNegocio, setSelectedNegocio] = useState<RpcConsultorNegocioPipeline | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data: negocios, isLoading } = useConsultorNegociosPipeline({
    consultor,
    enabled: !!consultor,
  });

  const contagens = useMemo(() => {
    let oport = 0;
    let cot = 0;
    let prop = 0;
    let quentes = 0;
    for (const n of negocios ?? []) {
      const u = (n.etapa || "").toUpperCase();
      if (u.includes("1-") || u.includes("OPORTUNIDADE")) oport++;
      else if (u.includes("2-") || u.includes("COTACAO") || u.includes("COTAÇÃO")) cot++;
      else if (u.includes("3-") || u.includes("PROPOSTA")) prop++;

      if (Number(n.estrelas || 0) >= 4) quentes++;
    }
    return { oport, cot, prop, quentes, total: negocios?.length ?? 0 };
  }, [negocios]);

  const negociosProcessados = useMemo(() => {
    const list = (negocios ?? []).filter((n) => {
      if (etapaFiltro === "TODOS") return true;
      if (etapaFiltro === "QUENTES") return Number(n.estrelas || 0) >= 4;
      const u = (n.etapa || "").toUpperCase();
      if (etapaFiltro === "OPORTUNIDADE") return u.includes("1-") || u.includes("OPORTUNIDADE");
      if (etapaFiltro === "COTACAO") return u.includes("2-") || u.includes("COTACAO") || u.includes("COTAÇÃO");
      if (etapaFiltro === "PROPOSTA") return u.includes("3-") || u.includes("PROPOSTA");
      return true;
    });

    return list.sort((a, b) => {
      if (ordenacao === "estrelas") {
        const diffEstrelas = Number(b.estrelas || 0) - Number(a.estrelas || 0);
        if (diffEstrelas !== 0) return diffEstrelas;
        return Number(b.valor || 0) - Number(a.valor || 0);
      }
      if (ordenacao === "valor") {
        return Number(b.valor || 0) - Number(a.valor || 0);
      }
      // Recentes
      const dateA = a.data_atualizacao || a.data_cadastro || "";
      const dateB = b.data_atualizacao || b.data_cadastro || "";
      return dateB.localeCompare(dateA);
    });
  }, [negocios, etapaFiltro, ordenacao]);

  const totalValorFiltrado = useMemo(
    () => negociosProcessados.reduce((sum, n) => sum + Number(n.valor || 0), 0),
    [negociosProcessados]
  );

  const handleOpenDetail = (n: RpcConsultorNegocioPipeline) => {
    setSelectedNegocio(n);
    setModalOpen(true);
  };

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
    <>
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
                  Termômetro de fechamento & classificação por estrelas
                </p>
              </div>
            </div>

            {/* Seletor de Ordenação */}
            <div className="flex items-center gap-1 text-[10px] font-mono">
              <span className="text-muted-foreground hidden sm:inline">Ordenar:</span>
              <select
                value={ordenacao}
                onChange={(e) => setOrdenacao(e.target.value as OrdenacaoTipo)}
                className="rounded-lg border bg-background px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
                style={{ borderColor: "var(--voux-card-border)" }}
              >
                <option value="estrelas">★ Mais Quentes</option>
                <option value="valor">R$ Maior Valor</option>
                <option value="recentes">🕒 Recentes</option>
              </select>
            </div>
          </div>

          {/* Filtros em Abas Rápidas */}
          <div className="flex items-center gap-1 mb-2.5 overflow-x-auto pb-1">
            {[
              { id: "TODOS", label: `Todos (${contagens.total})` },
              { id: "QUENTES", label: `🔥 Quentes (${contagens.quentes})` },
              { id: "OPORTUNIDADE", label: `1. Oport (${contagens.oport})` },
              { id: "COTACAO", label: `2. Cotaç (${contagens.cot})` },
              { id: "PROPOSTA", label: `3. Prop (${contagens.prop})` },
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
          {negociosProcessados.length === 0 ? (
            <div className="py-12 text-center text-xs text-muted-foreground">
              Nenhum negócio encontrado nesta etapa do pipeline.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 max-h-[420px] overflow-y-auto pr-1">
              {negociosProcessados.map((n) => {
                const etapaBadge = getEtapaBadge(n.etapa);
                const termometro = getTermometroBadge(n.estrelas);

                return (
                  <div
                    key={n.numero}
                    onClick={() => handleOpenDetail(n)}
                    onDoubleClick={() => handleOpenDetail(n)}
                    className="group rounded-xl border p-3 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.04] dark:hover:bg-white/[0.04] transition-all cursor-pointer hover:border-amber-500/40 relative"
                    style={{ borderColor: "var(--voux-card-border)" }}
                    title="Clique para ver todos os detalhes do negócio"
                  >
                    {/* Linha 1: Cliente e Valor Negociado */}
                    <div className="flex items-start justify-between gap-2 mb-1.5">
                      <div className="min-w-0 flex-1">
                        <p className="text-[13px] font-bold text-foreground truncate group-hover:text-amber-500 transition-colors">
                          {n.cliente}
                        </p>
                      </div>
                      <div className="text-right shrink-0 flex items-center gap-1.5">
                        <p className="text-[13px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatBRL(n.valor)}
                        </p>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>

                    {/* Linha 2: Badges de Etapa + Termômetro de Estrelas + Produto */}
                    <div className="flex items-center gap-1.5 mb-2 flex-wrap">
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold border", etapaBadge.bg)}>
                        {etapaBadge.label}
                      </span>

                      {/* Estrelinhas / Temperatura */}
                      <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border", termometro.bg)} title={termometro.label}>
                        <Flame className="h-3 w-3 text-amber-500 shrink-0" />
                        <span className="tracking-wider text-amber-500">{termometro.stars}</span>
                        <span>{termometro.label}</span>
                      </span>

                      <span className="text-[11px] font-mono text-foreground font-medium truncate flex items-center gap-1 max-w-[200px]" title={n.produto}>
                        <Package className="h-3 w-3 text-amber-500 shrink-0" />
                        {n.produto}
                      </span>
                    </div>

                    {/* Linha 3: Observações Detalhadas */}
                    {n.observacao && (
                      <div className="text-[10px] text-muted-foreground bg-black/[0.02] dark:bg-white/[0.03] rounded-lg p-2 leading-relaxed flex items-start gap-1.5 border border-black/5 dark:border-white/5">
                        <MessageSquare className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
                        <span className="line-clamp-2">{n.observacao}</span>
                      </div>
                    )}

                    {/* Linha 4: Cidade e Botão/Hint de Detalhes */}
                    <div className="mt-1.5 flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        {n.cidade || "Praça principal"} {n.uf ? `(${n.uf})` : ""}
                      </span>
                      <span className="text-[9px] text-amber-500/80 group-hover:text-amber-500 font-semibold flex items-center gap-0.5">
                        Ver ficha completa ➔
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer com Totalizador da Etapa Selecionada */}
        <div className="pt-3 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
          <span className="text-muted-foreground">
            {negociosProcessados.length} negócios · Total {etapaFiltro === "TODOS" ? "em Aberto" : "Filtrado"}:
          </span>
          <span className="font-bold text-foreground text-[13px] tabular-nums">{formatBRL(totalValorFiltrado)}</span>
        </div>
      </div>

      {/* Modal de Detalhes Completo do Negócio */}
      <ConsultorNegocioDetailModal
        negocio={selectedNegocio}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
});
