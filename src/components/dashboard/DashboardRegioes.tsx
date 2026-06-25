import { useMemo } from "react";
import type { RegiaoSummary, Registro, Filters } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/bi/charts";
import { Badge } from "@/components/ui/badge";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";

interface DashboardRegioesProps {
  regioes: RegiaoSummary[];
  registros: Registro[];
  filters: Filters;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

export const DashboardRegioes = ({ regioes, registros, filters }: DashboardRegioesProps) => {
  const isFiltered = hasActiveFilters(filters);

  const regioesData = useMemo(() => {
    if (!isFiltered) return [...regioes];

    const filtered = filterRegistros(registros, filters);
    const map = new Map<string, { totalAcoes: number; clientes: Set<string>; pipeline: number; visitas: number }>();
    for (const r of filtered) {
      if (!r.cidade) continue;
      if (!map.has(r.cidade)) map.set(r.cidade, { totalAcoes: 0, clientes: new Set(), pipeline: 0, visitas: 0 });
      const s = map.get(r.cidade)!;
      s.totalAcoes++;
      s.clientes.add(r.cliente);
      s.pipeline += r.negocioValor || 0;
      if (r.tipoContato?.toLowerCase().includes("visita")) s.visitas++;
    }
    return Array.from(map.entries())
      .map(([cidade, s]) => ({ cidade, totalAcoes: s.totalAcoes, clientes: s.clientes.size, pipeline: s.pipeline, visitas: s.visitas }))
      .sort((a, b) => b.pipeline - a.pipeline);
  }, [regioes, registros, filters, isFiltered]);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Análise Regional</h2>
        <p className="text-sm text-muted-foreground">
          Performance por região e oportunidades
          {isFiltered && <span className="ml-2 text-primary font-medium">({regioesData.length} regiões filtradas)</span>}
        </p>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Pipeline por Região</CardTitle>
        </CardHeader>
        <CardContent>
          <BarChart
            data={regioesData.slice(0, 20).map((r) => ({ name: r.cidade, pipeline: r.pipeline }))}
            layout="horizontal"
            keys={["pipeline"]}
            height={400}
            tooltipFormatter={(v) => formatCurrency(v)}
          />
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {regioesData.slice(0, 15).map((r, i) => (
          <Card key={r.cidade} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-semibold text-sm">{r.cidade}</h4>
                <Badge variant="outline" className="text-[10px]">#{i + 1}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <p className="text-lg font-bold text-primary">{formatCurrency(r.pipeline)}</p>
                  <p className="text-[10px] text-muted-foreground">Pipeline</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-accent">{r.clientes}</p>
                  <p className="text-[10px] text-muted-foreground">Clientes</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.totalAcoes}</p>
                  <p className="text-[10px] text-muted-foreground">Ações</p>
                </div>
                <div>
                  <p className="text-sm font-semibold">{r.visitas}</p>
                  <p className="text-[10px] text-muted-foreground">Visitas</p>
                </div>
              </div>
              <div className="mt-3 pt-2 border-t border-border">
                <p className="text-[10px] text-muted-foreground italic">
                  {r.pipeline > 1e6
                    ? "⚡ Alta prioridade — intensificar demonstrações"
                    : r.clientes > 20
                    ? "📋 Boa cobertura — foco em conversão"
                    : "🔍 Expandir prospecção na região"}
                </p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
