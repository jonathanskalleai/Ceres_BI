import { useMemo, useState } from "react";
import { DadosComerciais, Registro } from "@/types/comercial";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, Trophy, Sparkles } from "lucide-react";
import { Filters } from "@/types/comercial";
import { filterRegistros, hasActiveFilters } from "@/lib/filterUtils";
import { ConsultorReportSheet } from "./ConsultorReportSheet";
import { RankingClientesNovos } from "./RankingClientesNovos";

interface Props {
  data: DadosComerciais;
  filters: Filters;
  onSelectConsultor: (nome: string) => void;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

const crmBadge = (q: number) => {
  if (q >= 70) return <Badge className="bg-success text-success-foreground text-[10px]">A</Badge>;
  if (q >= 50) return <Badge className="bg-warning text-warning-foreground text-[10px]">B</Badge>;
  return <Badge variant="destructive" className="text-[10px]">{q >= 30 ? "C" : "D"}</Badge>;
};

export const DashboardConsultores = ({ data, filters, onSelectConsultor }: Props) => {
  const isFiltered = hasActiveFilters(filters);
  const [sheetOpen, setSheetOpen] = useState(false);

  const vendedores = useMemo(() => {
    if (!isFiltered) {
      return [...data.vendedores].sort((a, b) => b.pipeline - a.pipeline);
    }

    const filtered = filterRegistros(data.registrosRecentes, filters);
    const map = new Map<string, { acoes: number; pipeline: number; clientes: Set<string>; visitas: number }>();
    for (const r of filtered) {
      if (!map.has(r.vendedor)) map.set(r.vendedor, { acoes: 0, pipeline: 0, clientes: new Set(), visitas: 0 });
      const s = map.get(r.vendedor)!;
      s.acoes++;
      s.pipeline += r.negocioValor || 0;
      s.clientes.add(r.cliente);
      if (r.tipoContato?.toLowerCase().includes("visita")) s.visitas++;
    }

    return data.vendedores
      .filter((v) => map.has(v.nome))
      .map((v) => {
        const s = map.get(v.nome)!;
        return { ...v, totalAcoes: s.acoes, pipeline: s.pipeline, clientes: s.clientes.size, visitas: s.visitas };
      })
      .sort((a, b) => b.pipeline - a.pipeline);
  }, [data, filters, isFiltered]);

  const maxVals = useMemo(() => ({
    acoes: Math.max(...vendedores.map((v) => v.totalAcoes), 1),
    conv: Math.max(...vendedores.map((v) => v.conversao), 1),
    pipe: Math.max(...vendedores.map((v) => v.pipeline), 1),
    cli: Math.max(...vendedores.map((v) => v.clientes), 1),
    vis: Math.max(...vendedores.map((v) => v.visitas), 1),
  }), [vendedores]);

  const scored = useMemo(() => vendedores.map((v) => ({
    ...v,
    score: (v.totalAcoes / maxVals.acoes * 25 + v.conversao / maxVals.conv * 25 +
      v.pipeline / maxVals.pipe * 25 + v.clientes / maxVals.cli * 15 + v.visitas / maxVals.vis * 10),
  })).sort((a, b) => b.score - a.score), [vendedores, maxVals]);

  const top5 = scored.slice(0, 5);
  const medals = ["🥇", "🥈", "🥉", "4º", "5º"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Consultores</h2>
          <p className="text-sm text-muted-foreground">
            Performance e ranking da equipe comercial
            {isFiltered && <span className="ml-2 text-primary font-medium">({vendedores.length} consultores filtrados)</span>}
          </p>
        </div>
        <Button
          onClick={() => setSheetOpen(true)}
          className="bg-gradient-to-r from-primary to-accent text-primary-foreground shadow-md hover:shadow-lg transition-all"
        >
          <Sparkles className="h-4 w-4 mr-2" />
          Insights de IA
        </Button>
      </div>

      <ConsultorReportSheet open={sheetOpen} onOpenChange={setSheetOpen} data={data} />

      {top5.length > 0 && (
        <Card className="border-0 shadow-sm bg-gradient-to-r from-primary/5 to-accent/5">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="h-5 w-5 text-warning" />
              <h3 className="font-bold text-foreground">Ranking Top 5</h3>
            </div>
            <div className={`grid gap-3`} style={{ gridTemplateColumns: `repeat(${Math.min(top5.length, 5)}, 1fr)` }}>
              {top5.map((v, i) => (
                <button key={v.nome} onClick={() => onSelectConsultor(v.nome)}
                  className="p-3 rounded-lg bg-card text-left hover:shadow-md transition-shadow">
                  <span className="text-2xl">{medals[i]}</span>
                  <p className="font-semibold text-sm mt-1 truncate">{v.nome.split(" ").slice(-1)[0]}</p>
                  <p className="text-xs text-muted-foreground">{v.score.toFixed(0)} pts</p>
                  <p className="text-xs text-muted-foreground mt-1">{formatCurrency(v.pipeline)}</p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Ranking de Abertura de Clientes */}
      <RankingClientesNovos data={data} registros={isFiltered ? filterRegistros(data.registrosRecentes, filters) : data.registrosRecentes} filters={filters} />

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scored.map((v) => (
          <Card key={v.nome} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
            onClick={() => onSelectConsultor(v.nome)}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-sm truncate flex-1">{v.nome}</h4>
                {crmBadge(v.crmQuality)}
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-lg font-bold text-primary">{v.totalAcoes}</p>
                  <p className="text-[10px] text-muted-foreground">Ações</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-accent">{v.conversao}%</p>
                  <p className="text-[10px] text-muted-foreground">Conversão</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-warning">{formatCurrency(v.pipeline)}</p>
                  <p className="text-[10px] text-muted-foreground">Pipeline</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span>{v.clientes} clientes · {v.visitas} visitas</span>
                <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
