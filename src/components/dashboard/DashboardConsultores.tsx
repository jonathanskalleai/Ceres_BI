import { useMemo, useState } from "react";
import type { Vendedor, Registro, Filters } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, CalendarDays } from "lucide-react";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ConsultorReportSheet } from "./ConsultorReportSheet";
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

const CARD =
  "rounded-xl border bg-white p-5 transition-all duration-150";

export const DashboardConsultores = ({ vendedores, registros, filters, resumo, onSelectConsultor }: DashboardConsultoresProps) => {
  const isFiltered = hasActiveFilters(filters);
  const [sheetOpen, setSheetOpen] = useState(false);

  const resumoPorConsultor = useMemo(
    () => new Map(resumo.map((item) => [item.consultor, item])),
    [resumo],
  );

  // Ranking comercial: valor vendido (ganhos), visitas, ações — já vem ordenado da RPC
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

  // Totais do período para os KPIs de resumo
  const totals = useMemo(() => {
    let vendas = 0, pipeline = 0, oportunidades = 0, perdidos = 0;
    for (const r of resumo) {
      vendas += Number(r.valor_ganho ?? 0);
      pipeline += Number(r.pipeline_aberto_gerado ?? 0);
      oportunidades += Number(r.oportunidades_geradas ?? 0);
      perdidos += Number(r.valor_perdido ?? 0);
    }
    const totalGanhos = resumo.reduce((s, r) => s + Number(r.ganhos ?? 0), 0);
    const totalPerdidos = resumo.reduce((s, r) => s + Number(r.perdidos ?? 0), 0);
    return { vendas, pipeline, oportunidades, perdidos, totalGanhos, totalPerdidos };
  }, [resumo]);

  return (
    <div className="p-6 lg:p-8 space-y-8">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold tracking-tight" style={{ color: "var(--voux-text-primary)" }}>
              Desempenho dos consultores
            </h2>
            <span
              className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px]"
              style={{ color: "var(--voux-accent)", borderColor: "var(--voux-card-border)" }}
            >
              <CalendarDays className="h-3 w-3" />
              {periodoLabel}
            </span>
          </div>
          <p className="mt-1 text-xs" style={{ color: "var(--voux-text-faint)" }}>
            {vendedoresRanked.length} consultores · ranking por vendas, visitas e ações
          </p>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-full shadow-md font-semibold text-sm px-5"
          style={{ backgroundColor: "var(--voux-accent)", color: "#fff" }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Insights de IA
        </Button>
      </div>

      <ConsultorReportSheet open={sheetOpen} onOpenChange={setSheetOpen} vendedores={vendedores} />

      {/* KPIs de resumo — estilo screenshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { eyebrow: "VENDAS NO PERÍODO", value: formatCurrency(totals.vendas), hint: `${totals.totalGanhos} pedidos aprovados`, color: "#1f6e3f" },
          { eyebrow: "PIPELINE ABERTO", value: formatCurrency(totals.pipeline), hint: `${totals.oportunidades} oportunidades geradas`, color: "var(--voux-accent)" },
          { eyebrow: "PERDIDOS", value: formatCurrency(totals.perdidos), hint: `${totals.totalPerdidos} negócios perdidos`, color: "#b8421c" },
          { eyebrow: "TAXA DE CONVERSÃO", value: totals.oportunidades > 0 ? `${((totals.totalGanhos / totals.oportunidades) * 100).toFixed(1)}%` : "—", hint: `${totals.totalGanhos} ganhos ÷ ${totals.oportunidades} oportunidades`, color: "var(--voux-text-primary)" },
        ].map((kpi) => (
          <div
            key={kpi.eyebrow}
            className={cn(CARD)}
            style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
          >
            <p
              className="text-[10px] tracking-[0.18em] uppercase font-medium mb-2"
              style={{ fontFamily: "var(--voux-font-mono)", color: kpi.color }}
            >
              {kpi.eyebrow}
            </p>
            <p
              className="text-2xl lg:text-[28px] font-bold leading-none tracking-tight tabular-nums"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}
            >
              {kpi.value}
            </p>
            <p
              className="mt-2 text-[11px]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
            >
              {kpi.hint}
            </p>
          </div>
        ))}
      </div>

      {/* Ranking Top 5 — estilo tabela "Quem vende mais" */}
      {top5.length > 0 && (
        <div
          className={cn(CARD, "p-0 overflow-hidden")}
          style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
        >
          <div className="px-5 pt-5 pb-3">
            <p
              className="text-[10px] tracking-[0.18em] uppercase font-medium"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
            >
              POR VENDEDOR
            </p>
            <h3 className="text-base font-bold mt-1" style={{ color: "var(--voux-text-primary)" }}>
              Quem vende mais
            </h3>
          </div>
          {/* Table header */}
          <div
            className="grid grid-cols-[2fr_80px_70px_100px_100px_36px] items-center px-5 py-2 border-b text-[10px] tracking-[0.14em] uppercase font-medium"
            style={{ borderColor: "var(--voux-card-border)", fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
          >
            <span>CONSULTOR</span>
            <span className="text-center">VENDAS</span>
            <span className="text-center">VISITAS</span>
            <span className="text-right">VALOR VENDIDO</span>
            <span className="text-right">PIPELINE</span>
            <span></span>
          </div>
          {/* Table rows */}
          {top5.map((v, i) => {
            const r = resumoPorConsultor.get(v.nome);
            return (
              <button
                key={v.nome}
                onClick={() => onSelectConsultor(v.nome)}
                className="grid grid-cols-[2fr_80px_70px_100px_100px_36px] items-center px-5 py-3 w-full text-left hover:bg-[rgba(31,110,63,0.04)] transition-colors border-b last:border-b-0"
                style={{ borderColor: "var(--voux-card-border)" }}
              >
                <span className="flex items-center gap-3">
                  <span
                    className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold shrink-0"
                    style={{
                      background: i === 0 ? "rgba(31,110,63,0.12)" : "rgba(0,0,0,0.04)",
                      color: i === 0 ? "#1f6e3f" : "var(--voux-text-faint)",
                      fontFamily: "var(--voux-font-mono)",
                    }}
                  >
                    {i + 1}
                  </span>
                  <span className="font-medium text-sm truncate" style={{ color: "var(--voux-text-primary)" }}>
                    {v.nome}
                  </span>
                </span>
                <span
                  className="text-center text-sm font-bold tabular-nums"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "#1f6e3f" }}
                >
                  {r?.ganhos ?? 0}
                </span>
                <span
                  className="text-center text-sm tabular-nums"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}
                >
                  {v.visitas}
                </span>
                <span
                  className="text-right text-sm font-bold tabular-nums"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "#1f6e3f" }}
                >
                  {formatCurrency(Number(r?.valor_ganho ?? 0))}
                </span>
                <span
                  className="text-right text-sm tabular-nums"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}
                >
                  {formatCurrency(Number(r?.pipeline_aberto_gerado ?? 0))}
                </span>
                <ArrowRight className="h-3.5 w-3.5 ml-auto" style={{ color: "var(--voux-text-faint)" }} />
              </button>
            );
          })}
        </div>
      )}

      {/* Cards de todos os consultores */}
      <section className="space-y-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: "var(--voux-text-primary)" }}>Todos os consultores</h3>
          <p className="text-xs mt-0.5" style={{ color: "var(--voux-text-faint)" }}>
            Vendas, pipeline, atividade e conversão no calendário selecionado.
          </p>
        </div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {vendedoresRanked.map((v) => {
            const r = resumoPorConsultor.get(v.nome);
            return (
              <div
                key={v.nome}
                className={cn(CARD, "cursor-pointer group hover:shadow-md")}
                style={{ borderColor: "var(--voux-card-border)", boxShadow: "var(--voux-card-shadow)" }}
                onClick={() => onSelectConsultor(v.nome)}
              >
                {/* Nome */}
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-sm truncate flex-1" style={{ color: "var(--voux-text-primary)" }}>
                    {v.nome}
                  </h4>
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded border"
                    style={{
                      borderColor: v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c",
                      color: v.crmQuality >= 70 ? "#1f6e3f" : v.crmQuality >= 50 ? "#9c5e1c" : "#b8421c",
                      fontFamily: "var(--voux-font-mono)",
                    }}
                  >
                    {v.crmQuality >= 70 ? "A" : v.crmQuality >= 50 ? "B" : v.crmQuality >= 30 ? "C" : "D"}
                  </span>
                </div>

                {/* Resultado principal: Vendas + Pipeline */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="text-[9px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Vendas
                    </p>
                    <p className="text-lg font-bold leading-none tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "#1f6e3f" }}>
                      {formatCurrency(Number(r?.valor_ganho ?? 0))}
                    </p>
                    <p className="mt-1 text-[10px]" style={{ color: "var(--voux-text-faint)" }}>
                      {r?.ganhos ?? 0} pedidos aprovados
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Pipeline aberto
                    </p>
                    <p className="text-lg font-bold leading-none tabular-nums" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-primary)" }}>
                      {formatCurrency(Number(r?.pipeline_aberto_gerado ?? 0))}
                    </p>
                    <p className="mt-1 text-[10px]" style={{ color: "var(--voux-text-faint)" }}>
                      {r?.oportunidades_abertas ?? 0} oportunidades
                    </p>
                  </div>
                </div>

                {/* Atividade: ações, visitas, conversão */}
                <div className="grid grid-cols-3 gap-3 pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <div>
                    <p className="text-[9px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Ações
                    </p>
                    <p className="text-base font-bold leading-none tabular-nums" style={{ color: "var(--voux-text-primary)" }}>
                      {v.totalAcoes}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Visitas
                    </p>
                    <p className="text-base font-bold leading-none tabular-nums" style={{ color: "var(--voux-text-primary)" }}>
                      {v.visitas}
                    </p>
                  </div>
                  <div>
                    <p className="text-[9px] tracking-[0.14em] uppercase mb-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Conversão
                    </p>
                    <p className="text-base font-bold leading-none tabular-nums" style={{ color: "var(--voux-text-primary)" }}>
                      {r?.taxa_ganho == null ? "—" : `${r.taxa_ganho}%`}
                    </p>
                  </div>
                </div>

                {/* Footer */}
                <div className="mt-3 flex items-center justify-between pt-3 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-[10px]" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                    {v.clientes} clientes atendidos
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
