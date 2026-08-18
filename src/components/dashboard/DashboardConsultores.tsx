import { useMemo } from "react";
import type { Vendedor, Registro, Filters } from "@/types/comercial";
import { ArrowRight, CalendarDays, Trophy } from "lucide-react";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { InsightsEquipeCard } from "./consultor/InsightsEquipeCard";
import { RankingClientesNovos } from "./RankingClientesNovos";
import { ConsultoresValidationTable } from "./ConsultoresValidationTable";
import { cn } from "@/lib/utils";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import { formatDateBR } from "@/lib/dateUtils";

interface DashboardConsultoresProps {
  vendedores: Vendedor[];
  registros: Registro[];
  filters: Filters;
  resumo: RpcConsultorResumoAcoes[];
  onSelectConsultor: (nome: string) => void;
}

const formatCurrency = (v: number) => {
  if (v >= 1e6) return `R$ ${(v / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${v.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
};

const MEDAL_COLORS = [
  { bg: "linear-gradient(135deg, #ffd700 0%, #f5c842 100%)", text: "#7a5c00", ring: "rgba(255,215,0,0.3)" },  // Ouro
  { bg: "linear-gradient(135deg, #c0c0c0 0%, #e0e0e0 100%)", text: "#4a4a4a", ring: "rgba(192,192,192,0.3)" },  // Prata
  { bg: "linear-gradient(135deg, #cd7f32 0%, #e8a855 100%)", text: "#5c3600", ring: "rgba(205,127,50,0.3)" },  // Bronze
  { bg: "linear-gradient(135deg, #8a7a6a 0%, #a09080 100%)", text: "#3d3530", ring: "rgba(138,122,106,0.2)" },
  { bg: "linear-gradient(135deg, #8a7a6a 0%, #a09080 100%)", text: "#3d3530", ring: "rgba(138,122,106,0.2)" },
];

export const DashboardConsultores = ({ vendedores, registros, filters, resumo, onSelectConsultor }: DashboardConsultoresProps) => {
  const isFiltered = hasActiveFilters(filters);

  const resumoPorConsultor = useMemo(
    () => new Map(resumo.map((item) => [item.consultor, item])),
    [resumo],
  );

  const vendedoresRanked = useMemo(() => {
    return [...vendedores].sort((a, b) => {
      const aR = resumoPorConsultor.get(a.nome);
      const bR = resumoPorConsultor.get(b.nome);
      return Number(bR?.valor_ganho ?? 0) - Number(aR?.valor_ganho ?? 0)
        || b.visitas - a.visitas
        || b.totalAcoes - a.totalAcoes
        || a.nome.localeCompare(b.nome, "pt-BR");
    });
  }, [vendedores, resumoPorConsultor]);

  const periodoLabel = filters.dateRange
    ? `${formatDateBR(filters.dateRange.from)} a ${formatDateBR(filters.dateRange.to)}`
    : "Período selecionado";

  const top5 = vendedoresRanked.slice(0, 5);
  const maxVendas = Math.max(...top5.map((v) => Number(resumoPorConsultor.get(v.nome)?.valor_ganho ?? 0)), 1);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2
            className="text-xl font-bold tracking-tight"
            style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
          >
            Consultores
          </h2>
          <div className="flex items-center gap-2 mt-1.5">
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] tabular-nums"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-accent)", borderColor: "var(--voux-card-border)" }}
            >
              <CalendarDays className="h-3 w-3" />
              {periodoLabel}
            </span>
            <span className="text-[12px]" style={{ color: "var(--voux-text-faint)" }}>
              {vendedoresRanked.length} ativos
            </span>
          </div>
        </div>
      </div>

      {/* Insights IA da Equipe */}
      <InsightsEquipeCard consultores={vendedoresRanked.map((v) => v.nome)} />

      {/* ═══════════════════════════════════════
          RANKING TOP 5 — Visual impactante
          ═══════════════════════════════════════ */}
      {top5.length > 0 && (
        <section className="space-y-5">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4" style={{ color: "var(--voux-accent)" }} />
            <span
              className="text-[12px] tracking-[0.22em] uppercase font-medium"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
            >
              Ranking de performance
            </span>
          </div>

          <div className="space-y-2">
            {top5.map((v, i) => {
              const r = resumoPorConsultor.get(v.nome);
              const valorGanho = Number(r?.valor_ganho ?? 0);
              const pct = maxVendas > 0 ? (valorGanho / maxVendas) * 100 : 0;
              const medal = MEDAL_COLORS[i];

              return (
                <button
                  key={v.nome}
                  onClick={() => onSelectConsultor(v.nome)}
                  className={cn(
                    "w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all duration-200",
                    "hover:shadow-lg hover:scale-[1.005] hover:border-[var(--voux-accent)]",
                    i === 0 && "p-5",
                  )}
                  style={{
                    background: "var(--surface-raised)",
                    borderColor: "var(--voux-card-border)",
                    boxShadow: i === 0 ? "0 4px 20px -4px rgba(31,110,63,0.12)" : "var(--voux-card-shadow)",
                  }}
                >
                  {/* Medalha/Posição */}
                  <div
                    className="flex items-center justify-center shrink-0 rounded-full font-bold"
                    style={{
                      width: i === 0 ? 44 : 36,
                      height: i === 0 ? 44 : 36,
                      background: medal.bg,
                      color: medal.text,
                      fontSize: i === 0 ? 16 : 13,
                      fontFamily: "var(--voux-font-mono)",
                      boxShadow: `0 2px 8px ${medal.ring}`,
                    }}
                  >
                    {i + 1}º
                  </div>

                  {/* Nome + métricas secundárias */}
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn("font-bold truncate", i === 0 ? "text-base" : "text-sm")}
                      style={{ color: "var(--voux-text-heading)", fontFamily: "var(--voux-font-sans)" }}
                    >
                      {v.nome}
                    </p>
                    <p className="text-[12px] mt-0.5" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}>
                      {r?.ganhos ?? 0} vendas · {v.visitas} visitas · {v.totalAcoes} ações
                    </p>
                  </div>

                  {/* Barra de performance relativa */}
                  <div className="hidden md:flex items-center gap-3 w-[200px] shrink-0">
                    <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "var(--voux-card-border)" }}>
                      <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                          width: `${Math.max(pct, 4)}%`,
                          background: i === 0 ? "#1f6e3f" : i < 3 ? "var(--voux-accent)" : "var(--voux-text-faint)",
                          opacity: i < 3 ? 1 : 0.5,
                        }}
                      />
                    </div>
                  </div>

                  {/* Valor vendido */}
                  <div className="text-right shrink-0">
                    <p
                      className={cn("font-bold tabular-nums", i === 0 ? "text-lg" : "text-sm")}
                      style={{ fontFamily: "var(--voux-font-sans)", color: "#1f6e3f" }}
                    >
                      {formatCurrency(valorGanho)}
                    </p>
                    <p className="text-[12px]" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}>
                      vendido
                    </p>
                  </div>

                  {/* Arrow */}
                  <ArrowRight className="h-4 w-4 shrink-0 opacity-30 group-hover:opacity-100" style={{ color: "var(--voux-text-faint)" }} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {/* ═══════════════════════════════════════
          TODOS OS CONSULTORES — Cards
          ═══════════════════════════════════════ */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: "var(--voux-text-heading)", fontFamily: "var(--voux-font-display)" }}>
            Todos os consultores
          </h3>
          <p className="text-[12px] mt-0.5" style={{ color: "var(--voux-text-faint)" }}>
            Clique para ver a visão individual completa.
          </p>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vendedoresRanked.map((v) => {
            const r = resumoPorConsultor.get(v.nome);
            return (
              <div
                key={v.nome}
                className="rounded-xl border bg-white p-5 cursor-pointer group transition-all duration-200 hover:shadow-md hover:border-[var(--voux-accent)]"
                style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
                onClick={() => onSelectConsultor(v.nome)}
              >
                {/* Nome + CRM badge */}
                <div className="flex items-center justify-between mb-4">
                  <h4
                    className="font-semibold text-sm truncate flex-1"
                    style={{ color: "var(--voux-text-heading)", fontFamily: "var(--voux-font-sans)" }}
                  >
                    {v.nome}
                  </h4>
                  <span
                    className="text-[12px] font-bold px-1.5 py-0.5 rounded border"
                    style={{
                      borderColor: v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c",
                      color: v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c",
                      fontFamily: "var(--voux-font-mono)",
                    }}
                  >
                    {v.crmQuality >= 70 ? "A" : v.crmQuality >= 50 ? "B" : v.crmQuality >= 30 ? "C" : "D"}
                  </span>
                </div>

                {/* Vendas + Pipeline */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[11px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Vendas
                    </p>
                    <p className="text-lg font-bold leading-none tabular-nums" style={{ fontFamily: "var(--voux-font-sans)", color: "#1f6e3f" }}>
                      {formatCurrency(Number(r?.valor_ganho ?? 0))}
                    </p>
                    <p className="mt-1 text-[12px]" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}>
                      {r?.ganhos ?? 0} pedidos
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Pipeline
                    </p>
                    <p className="text-lg font-bold leading-none tabular-nums" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-primary)" }}>
                      {formatCurrency(Number(r?.pipeline_aberto_gerado ?? 0))}
                    </p>
                    <p className="mt-1 text-[12px]" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}>
                      {r?.oportunidades_abertas ?? 0} oportunidades
                    </p>
                  </div>
                </div>

                {/* Ações, Visitas, Conversão */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <div>
                    <p className="text-[11px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>Ações</p>
                    <p className="text-base font-bold tabular-nums" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-primary)" }}>{v.totalAcoes}</p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>Visitas</p>
                    <p className="text-base font-bold tabular-nums" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-primary)" }}>{v.visitas}</p>
                  </div>
                  <div>
                    <p className="text-[11px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>Conv.</p>
                    <p className="text-base font-bold tabular-nums" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-primary)" }}>{r?.taxa_ganho == null ? "—" : `${r.taxa_ganho}%`}</p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-[12px]" style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-faint)" }}>
                    {v.clientes} clientes
                  </span>
                  <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" style={{ color: "var(--voux-text-faint)" }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <RankingClientesNovos
        registros={isFiltered ? filterRegistros(registros, filters) : registros}
        filters={filters}
      />

      <ConsultoresValidationTable
        resumo={resumo}
        from={filters.dateRange?.from ?? ""}
        to={filters.dateRange?.to ?? ""}
        onSelectConsultor={onSelectConsultor}
      />
    </div>
  );
};
