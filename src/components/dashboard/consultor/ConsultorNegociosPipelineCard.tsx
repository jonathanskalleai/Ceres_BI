import { memo, useState } from "react";
import { Briefcase, ChevronRight, Package, MessageSquare, MapPin } from "lucide-react";
import { useConsultorNegociosPipeline } from "@/hooks/useConsultoresRpc";
import { Skeleton } from "@/components/ui/skeleton";
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
  const { data: negocios, isLoading } = useConsultorNegociosPipeline({
    consultor,
    enabled: !!consultor,
  });

  const totalValor = (negocios ?? []).reduce((sum, n) => sum + Number(n.valor || 0), 0);

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
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-2xl border p-5 flex flex-col justify-between h-full"
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
                Oportunidades, Cotações e Propostas em andamento
              </p>
            </div>
          </div>

          <div className="text-right">
            <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-background">
              {negocios?.length ?? 0} negócios
            </span>
          </div>
        </div>

        {/* Lista de Negócios */}
        {(!negocios || negocios.length === 0) ? (
          <div className="py-8 text-center text-xs text-muted-foreground">
            Nenhum negócio ativo no pipeline de vendas no momento.
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
            {negocios.map((n) => {
              const badge = getEtapaBadge(n.etapa);
              return (
                <div
                  key={n.numero}
                  className="rounded-xl border p-2.5 bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03] transition-colors"
                  style={{ borderColor: "var(--voux-card-border)" }}
                >
                  {/* Linha 1: Cliente, Badge da Etapa e Valor */}
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div className="min-w-0 flex-1">
                      <p className="text-[12px] font-bold text-foreground truncate" title={n.cliente}>
                        {n.cliente}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[12px] font-mono font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                        {formatBRL(n.valor)}
                      </p>
                    </div>
                  </div>

                  {/* Linha 2: Badge de Etapa e Produto */}
                  <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                    <span className={cn("inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono font-bold border", badge.bg)}>
                      {badge.label}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground truncate flex items-center gap-1">
                      <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                      {n.produto}
                    </span>
                  </div>

                  {/* Linha 3: Observações */}
                  {n.observacao && (
                    <p className="text-[10px] text-muted-foreground bg-black/[0.02] dark:bg-white/[0.03] rounded p-1.5 line-clamp-2 leading-relaxed flex items-start gap-1">
                      <MessageSquare className="h-3 w-3 text-muted-foreground shrink-0 mt-0.5" />
                      <span>{n.observacao}</span>
                    </p>
                  )}

                  {/* Linha 4: Cidade / Praça */}
                  {n.cidade && (
                    <div className="mt-1 flex items-center justify-between text-[9px] font-mono text-muted-foreground">
                      <span className="flex items-center gap-0.5">
                        <MapPin className="h-2.5 w-2.5" />
                        {n.cidade}
                      </span>
                      <span>#{n.numero}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer com Totalizador */}
      <div className="pt-2.5 mt-3 border-t flex items-center justify-between text-[11px] font-mono" style={{ borderColor: "var(--voux-card-border)" }}>
        <span className="text-muted-foreground">Valor Total em Aberto:</span>
        <span className="font-bold text-foreground">{formatBRL(totalValor)}</span>
      </div>
    </div>
  );
});
