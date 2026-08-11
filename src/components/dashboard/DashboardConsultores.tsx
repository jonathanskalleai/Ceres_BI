import { useMemo, useState } from "react";
import type { Vendedor, Registro, Filters } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Sparkles, TrendingUp, Users, DollarSign, Eye, Target, BarChart3 } from "lucide-react";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ConsultorReportSheet } from "./ConsultorReportSheet";
import { RankingClientesNovos } from "./RankingClientesNovos";
import { SectionEyebrow } from "@/components/bi/SectionEyebrow";
import { cn } from "@/lib/utils";

interface DashboardConsultoresProps {
  vendedores: Vendedor[];
  registros: Registro[];
  filters: Filters;
  onSelectConsultor: (nome: string) => void;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

function CrmBadge({ q }: { q: number }) {
  const grade = q >= 70 ? "A" : q >= 50 ? "B" : q >= 30 ? "C" : "D";
  const colors: Record<string, string> = {
    A: "var(--voux-success, #1f6e3f)",
    B: "var(--voux-warning, #9c5e1c)",
    C: "var(--voux-warning, #9c5e1c)",
    D: "var(--voux-danger, #b8421c)",
  };
  return (
    <span
      className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 font-mono text-[10px] font-bold"
      style={{ borderColor: colors[grade], color: colors[grade] }}
    >
      {grade}
    </span>
  );
}

function ScoreBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="h-1 w-full rounded-full overflow-hidden" style={{ background: "var(--voux-card-border)" }}>
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{ width: `${pct}%`, background: color }}
      />
    </div>
  );
}

export const DashboardConsultores = ({ vendedores, registros, filters, onSelectConsultor }: DashboardConsultoresProps) => {
  const isFiltered = hasActiveFilters(filters);
  const [sheetOpen, setSheetOpen] = useState(false);

  const vendedoresRanked = useMemo(() => {
    if (!isFiltered) {
      return [...vendedores].sort((a, b) => b.pipeline - a.pipeline);
    }

    const filtered = filterRegistros(registros, filters);
    const map = new Map<string, { acoes: number; pipeline: number; clientes: Set<string>; visitas: number }>();
    for (const r of filtered) {
      if (!map.has(r.vendedor)) map.set(r.vendedor, { acoes: 0, pipeline: 0, clientes: new Set(), visitas: 0 });
      const s = map.get(r.vendedor)!;
      s.acoes++;
      s.pipeline += r.negocioValor || 0;
      s.clientes.add(r.cliente);
      if (r.tipoContato?.toLowerCase().includes("visita")) s.visitas++;
    }

    return vendedores
      .filter((v) => map.has(v.nome))
      .map((v) => {
        const s = map.get(v.nome)!;
        return { ...v, totalAcoes: s.acoes, pipeline: s.pipeline, clientes: s.clientes.size, visitas: s.visitas };
      })
      .sort((a, b) => b.pipeline - a.pipeline);
  }, [vendedores, registros, filters, isFiltered]);

  const maxVals = useMemo(() => ({
    acoes: Math.max(...vendedoresRanked.map((v) => v.totalAcoes), 1),
    conv: Math.max(...vendedoresRanked.map((v) => v.conversao), 1),
    pipe: Math.max(...vendedoresRanked.map((v) => v.pipeline), 1),
    cli: Math.max(...vendedoresRanked.map((v) => v.clientes), 1),
    vis: Math.max(...vendedoresRanked.map((v) => v.visitas), 1),
  }), [vendedoresRanked]);

  const scored = useMemo(() => vendedoresRanked.map((v) => ({
    ...v,
    score: (v.totalAcoes / maxVals.acoes * 25 + v.conversao / maxVals.conv * 25 +
      v.pipeline / maxVals.pipe * 25 + v.clientes / maxVals.cli * 15 + v.visitas / maxVals.vis * 10),
  })).sort((a, b) => b.score - a.score), [vendedoresRanked, maxVals]);

  const top5 = scored.slice(0, 5);

  // Summary KPIs
  const totalAcoes = scored.reduce((s, v) => s + v.totalAcoes, 0);
  const totalPipeline = scored.reduce((s, v) => s + v.pipeline, 0);
  const totalClientes = scored.reduce((s, v) => s + v.clientes, 0);
  const totalVisitas = scored.reduce((s, v) => s + v.visitas, 0);

  return (
    <div className="p-8 space-y-8">
      {/* Header + action */}
      <div className="flex items-center justify-between">
        <div>
          {isFiltered && (
            <p
              className="text-[11px] tracking-[0.12em] uppercase font-medium"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              {vendedoresRanked.length} consultores filtrados
            </p>
          )}
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-full shadow-md font-semibold text-sm px-5 border-0"
          style={{
            backgroundColor: "var(--voux-accent)",
            color: "#fff",
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Insights de IA
        </Button>
      </div>

      <ConsultorReportSheet open={sheetOpen} onOpenChange={setSheetOpen} vendedores={vendedores} />

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Ações", value: totalAcoes.toLocaleString("pt-BR"), icon: TrendingUp, color: "var(--voux-accent)" },
          { label: "Pipeline Total", value: formatCurrency(totalPipeline), icon: DollarSign, color: "#1f6e3f" },
          { label: "Clientes Únicos", value: totalClientes.toLocaleString("pt-BR"), icon: Users, color: "#1d4f8a" },
          { label: "Total Visitas", value: totalVisitas.toLocaleString("pt-BR"), icon: Eye, color: "#6a2f99" },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="relative overflow-hidden rounded-xl px-4 py-3 md:px-5 md:py-3.5 border transition-colors"
            style={{
              borderColor: "var(--voux-card-border)",
              boxShadow: "var(--voux-card-shadow)",
              borderLeftColor: kpi.color,
              borderLeftWidth: 3,
            }}
          >
            <div className="flex items-start justify-between mb-2 gap-2">
              <span
                className="text-[11px] tracking-[0.12em] uppercase leading-snug font-medium"
                style={{ fontFamily: "var(--voux-font-label)", color: "var(--voux-label)" }}
              >
                {kpi.label}
              </span>
              <span
                className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0"
                style={{
                  background: `color-mix(in srgb, ${kpi.color} 12%, transparent)`,
                  color: kpi.color,
                }}
              >
                <kpi.icon className="h-3 w-3" />
              </span>
            </div>
            <div
              className="text-2xl sm:text-[28px] font-semibold leading-none tracking-[-0.02em] tabular-nums"
              style={{ color: kpi.color }}
            >
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Top 5 ranking */}
      {top5.length > 0 && (
        <div className="space-y-4">
          <SectionEyebrow label="Ranking Top 5" />
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(top5.length, 5)}, 1fr)` }}
          >
            {top5.map((v, i) => (
              <button
                key={v.nome}
                onClick={() => onSelectConsultor(v.nome)}
                className="relative overflow-hidden rounded-2xl p-5 border text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg group"
                style={{
                  background: "var(--surface-raised)",
                  borderColor: "var(--voux-card-border)",
                  boxShadow: "var(--voux-card-shadow)",
                  borderTopWidth: 3,
                  borderTopColor: i === 0 ? "#d4a017" : i === 1 ? "#a0a0a0" : i === 2 ? "#cd7f32" : "var(--voux-accent)",
                }}
              >
                {/* Rank badge */}
                <div className="flex items-center justify-between mb-3">
                  <span
                    className="inline-flex items-center justify-center w-7 h-7 rounded-full text-[11px] font-bold"
                    style={{
                      background: i === 0 ? "rgba(212,160,23,0.12)" : i === 1 ? "rgba(160,160,160,0.12)" : i === 2 ? "rgba(205,127,50,0.12)" : "color-mix(in srgb, var(--voux-accent) 10%, transparent)",
                      color: i === 0 ? "#d4a017" : i === 1 ? "#808080" : i === 2 ? "#cd7f32" : "var(--voux-accent)",
                      fontFamily: "var(--voux-font-mono)",
                    }}
                  >
                    {i + 1}º
                  </span>
                  <Trophy
                    className="h-4 w-4"
                    style={{ color: i === 0 ? "#d4a017" : i === 1 ? "#a0a0a0" : i === 2 ? "#cd7f32" : "var(--voux-text-faint)", opacity: i < 3 ? 0.8 : 0.3 }}
                  />
                </div>
                {/* Nome */}
                <p
                  className="text-lg font-bold leading-tight tracking-[-0.02em] mb-1"
                  style={{ color: "var(--voux-text-heading)" }}
                >
                  {v.nome.split(" ").slice(-1)[0]}
                </p>
                <p
                  className="text-[11px] mb-3 truncate"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
                >
                  {v.nome.split(" ").slice(0, -1).join(" ")}
                </p>
                {/* Score + Pipeline */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] tracking-wide uppercase" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Score
                    </span>
                    <span className="text-sm font-bold" style={{ color: "var(--voux-accent)" }}>
                      {v.score.toFixed(0)} pts
                    </span>
                  </div>
                  <ScoreBar value={v.score} max={100} color="var(--voux-accent)" />
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-[10px] tracking-wide uppercase" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                      Pipeline
                    </span>
                    <span className="text-sm font-semibold" style={{ color: "var(--voux-text-heading)" }}>
                      {formatCurrency(v.pipeline)}
                    </span>
                  </div>
                </div>
                {/* Arrow on hover */}
                <ArrowRight
                  className="absolute bottom-4 right-4 h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
                  style={{ color: "var(--voux-accent)" }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Ranking de Abertura de Clientes */}
      <RankingClientesNovos
        registros={isFiltered ? filterRegistros(registros, filters) : registros}
        filters={filters}
      />

      {/* Cards de consultores — full grid */}
      <div className="space-y-4">
        <SectionEyebrow label="Todos os Consultores" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {scored.map((v) => (
            <div
              key={v.nome}
              className="relative overflow-hidden rounded-2xl p-5 border cursor-pointer group transition-all duration-200 hover:shadow-lg hover:scale-[1.01]"
              style={{
                background: "var(--surface-raised)",
                borderColor: "var(--voux-card-border)",
                boxShadow: "var(--voux-card-shadow)",
              }}
              onClick={() => onSelectConsultor(v.nome)}
            >
              {/* Header: Nome + Badge */}
              <div className="flex items-center justify-between mb-4">
                <h4
                  className="font-semibold text-sm truncate flex-1"
                  style={{ color: "var(--voux-text-heading)" }}
                >
                  {v.nome}
                </h4>
                <CrmBadge q={v.crmQuality} />
              </div>

              {/* Métricas grid */}
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <TrendingUp className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                    <span
                      className="text-[9px] tracking-[0.14em] uppercase"
                      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                    >
                      Ações
                    </span>
                  </div>
                  <p className="text-xl font-bold leading-none tabular-nums" style={{ color: "var(--voux-accent)" }}>
                    {v.totalAcoes}
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <Target className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                    <span
                      className="text-[9px] tracking-[0.14em] uppercase"
                      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                    >
                      Conv.
                    </span>
                  </div>
                  <p className="text-xl font-bold leading-none tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                    {v.conversao}%
                  </p>
                </div>
                <div>
                  <div className="flex items-center gap-1 mb-1.5">
                    <DollarSign className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                    <span
                      className="text-[9px] tracking-[0.14em] uppercase"
                      style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                    >
                      Pipeline
                    </span>
                  </div>
                  <p className="text-lg font-bold leading-none tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                    {formatCurrency(v.pipeline)}
                  </p>
                </div>
              </div>

              {/* Score bar */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] tracking-wide uppercase" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}>
                    Performance
                  </span>
                  <span className="text-[10px] font-bold" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-accent)" }}>
                    {v.score.toFixed(0)}%
                  </span>
                </div>
                <ScoreBar value={v.score} max={100} color="var(--voux-accent)" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--voux-card-border)" }}>
                <span
                  className="text-[10px]"
                  style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-faint)" }}
                >
                  {v.clientes} clientes · {v.visitas} visitas
                </span>
                <ArrowRight
                  className="h-3.5 w-3.5 group-hover:translate-x-1 transition-all"
                  style={{ color: "var(--voux-text-faint)" }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
