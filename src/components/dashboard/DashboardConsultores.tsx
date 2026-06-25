import { useMemo, useState } from "react";
import type { Vendedor, Registro, Filters } from "@/types/comercial";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Sparkles, TrendingUp, Users, DollarSign } from "lucide-react";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ConsultorReportSheet } from "./ConsultorReportSheet";
import { RankingClientesNovos } from "./RankingClientesNovos";
import { cn } from "@/lib/utils";

interface DashboardConsultoresProps {
  vendedores: Vendedor[];
  registros: Registro[];
  filters: Filters;
  onSelectConsultor: (nome: string) => void;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

const CARD_BASE =
  "relative overflow-hidden rounded-[20px] p-[22px_24px] border";

function CrmBadge({ q }: { q: number }) {
  const grade = q >= 70 ? "A" : q >= 50 ? "B" : q >= 30 ? "C" : "D";
  const colors: Record<string, string> = {
    A: "border-[#4ade80] text-[#4ade80]",
    B: "border-[#facc15] text-[#facc15]",
    C: "border-[var(--voux-warning)] text-[var(--voux-warning)]",
    D: "border-[var(--voux-danger)] text-[var(--voux-danger)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center justify-center w-5 h-5 rounded-full border font-mono text-[10px] font-bold",
        colors[grade],
      )}
    >
      {grade}
    </span>
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
  const rankLabel = ["01", "02", "03", "04", "05"];

  return (
    <div className="p-6 space-y-6">
      {/* Action bar */}
      <div className="flex items-center justify-between">
        <div>
          {isFiltered && (
            <p className="text-xs font-mono" style={{ color: "var(--voux-text-faint)" }}>
              {vendedoresRanked.length} consultores filtrados
            </p>
          )}
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="rounded-full shadow-md font-semibold text-sm px-5"
          style={{
            backgroundColor: "var(--voux-accent)",
            color: "var(--voux-card-to)",
          }}
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Insights de IA
        </Button>
      </div>

      <ConsultorReportSheet open={sheetOpen} onOpenChange={setSheetOpen} vendedores={vendedores} />

      {/* Top 5 ranking */}
      {top5.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-3.5 w-3.5" style={{ color: "var(--voux-accent)" }} />
            <span className="font-mono text-[10px] tracking-[0.22em] uppercase" style={{ color: "var(--voux-text-faint)" }}>
              Ranking Top 5
            </span>
          </div>
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${Math.min(top5.length, 5)}, 1fr)` }}
          >
            {top5.map((v, i) => (
              <button
                key={v.nome}
                onClick={() => onSelectConsultor(v.nome)}
                className={cn(CARD_BASE, "text-left transition-colors")}
                style={{
                  background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
                  borderColor: "var(--voux-card-border)",
                  boxShadow: "var(--voux-card-shadow)",
                  borderLeftColor: "var(--voux-accent)",
                  borderLeftWidth: 3,
                }}
              >
                {/* Eyebrow */}
                <div className="flex items-center justify-between mb-4">
                  <span className="font-mono text-[10px] tracking-[0.22em]" style={{ color: "var(--voux-accent)" }}>
                    {rankLabel[i]} ·
                  </span>
                  <Trophy className="h-3 w-3 opacity-30" style={{ color: "var(--voux-text-faint)" }} />
                </div>
                {/* Nome */}
                <p className="text-[22px] font-bold leading-none tracking-[-0.02em] mb-2" style={{ color: "var(--voux-text-primary)" }}>
                  {v.nome.split(" ").slice(-1)[0]}
                </p>
                {/* Hint */}
                <p className="font-mono text-[11px]" style={{ color: "var(--voux-text-faint)" }}>
                  {v.score.toFixed(0)} pts · {formatCurrency(v.pipeline)}
                </p>
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

      {/* Cards de consultores */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scored.map((v) => (
          <div
            key={v.nome}
            className={cn(CARD_BASE, "cursor-pointer group transition-colors")}
            style={{
              background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
              borderColor: "var(--voux-card-border)",
              boxShadow: "var(--voux-card-shadow)",
            }}
            onClick={() => onSelectConsultor(v.nome)}
          >
            {/* Nome + badge */}
            <div className="flex items-center justify-between mb-4">
              <h4 className="font-semibold text-sm truncate flex-1" style={{ color: "var(--voux-text-primary)" }}>{v.nome}</h4>
              <CrmBadge q={v.crmQuality} />
            </div>

            {/* Métricas */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <TrendingUp className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Ações</span>
                </div>
                <p className="text-[22px] font-bold leading-none" style={{ color: "var(--voux-accent)" }}>{v.totalAcoes}</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <Users className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Conv.</span>
                </div>
                <p className="text-[22px] font-bold leading-none" style={{ color: "var(--voux-text-primary)" }}>{v.conversao}%</p>
              </div>
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <DollarSign className="h-3 w-3" style={{ color: "var(--voux-text-faint)" }} />
                  <span className="font-mono text-[9px] tracking-[0.14em] uppercase" style={{ color: "var(--voux-text-faint)" }}>Pipeline</span>
                </div>
                <p className="text-[18px] font-bold leading-none" style={{ color: "var(--voux-text-primary)" }}>{formatCurrency(v.pipeline)}</p>
              </div>
            </div>

            {/* Rodapé */}
            <div className="mt-4 flex items-center justify-between">
              <span className="font-mono text-[10px]" style={{ color: "var(--voux-text-faint)" }}>
                {v.clientes} clientes · {v.visitas} visitas
              </span>
              <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-all" style={{ color: "var(--voux-text-faint)" }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
