import { useMemo } from "react";
import { DadosComerciais } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/bi/KPICard";
import { Users, MapPin, TrendingUp, Eye, DollarSign, BarChart3 } from "lucide-react";
import { BarChart, LineChart, PieChart } from "@/components/bi/charts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { PieChartData } from "@/components/bi/charts";
import { Filters } from "@/types/comercial";
import { filterRegistros, filterEvolucao, hasActiveFilters } from "@/lib/filterUtils";
import { formatMonthYear } from "@/lib/dateUtils";

interface Props {
  data: DadosComerciais;
  filters: Filters;
  onSelectConsultor: (nome: string) => void;
  totalRegistrosBase?: number;
}

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

export const DashboardOverview = ({ data, filters, onSelectConsultor, totalRegistrosBase }: Props) => {
  const isFiltered = hasActiveFilters(filters);
  const filtered = useMemo(() => filterRegistros(data.registrosRecentes, filters), [data, filters]);

  // Use pre-computed KPIs when no filters, compute from filtered records otherwise
  const kpis = useMemo(() => {
    if (!isFiltered) {
      return {
        ...data.kpis,
        totalRegistros: totalRegistrosBase ?? data.kpis.totalRegistros,
      };
    }
    const clientes = new Set(filtered.map((r) => r.cliente));
    const vendedores = new Set(filtered.map((r) => r.vendedor));
    const cidades = new Set(filtered.map((r) => r.cidade));
    const visitas = filtered.filter((r) => r.tipoContato?.toLowerCase().includes("visita")).length;
    const pipeline = filtered.reduce((s, r) => s + (r.negocioValor || 0), 0);
    return {
      totalRegistros: filtered.length,
      totalClientes: clientes.size,
      totalConsultores: vendedores.size,
      totalPipeline: pipeline,
      totalVisitas: visitas,
      totalCidades: cidades.size,
    };
  }, [data, filtered, isFiltered, totalRegistrosBase]);

  const evolucaoFiltered = useMemo(() => filterEvolucao(data.evolucaoGlobal, filters), [data, filters]);

  const topConsultores = useMemo(() => {
    if (!isFiltered) {
      return [...data.vendedores]
        .sort((a, b) => b.totalAcoes - a.totalAcoes)
        .slice(0, 10)
        .map((v) => ({ nome: v.nome.split(" ").slice(-1)[0], acoes: v.totalAcoes, full: v.nome }));
    }
    const map = new Map<string, number>();
    for (const r of filtered) {
      map.set(r.vendedor, (map.get(r.vendedor) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([nome, acoes]) => ({ nome: nome.split(" ").slice(-1)[0], acoes, full: nome }))
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 10);
  }, [data, filtered, isFiltered]);

  const tiposContato = useMemo(() => {
    if (!isFiltered) return Object.entries(data.tiposContato).map(([name, value]) => ({ name, value }));
    const map = new Map<string, number>();
    for (const r of filtered) if (r.tipoContato) map.set(r.tipoContato, (map.get(r.tipoContato) || 0) + 1);
    return Array.from(map.entries()).map(([name, value]) => ({ name, value }));
  }, [data, filtered, isFiltered]);

  const tiposAcao = useMemo(() => {
    if (!isFiltered) {
      return Object.entries(data.tiposAcao).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
    }
    const map = new Map<string, number>();
    for (const r of filtered) if (r.tipoAcao) map.set(r.tipoAcao, (map.get(r.tipoAcao) || 0) + 1);
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value]) => ({ name, value }));
  }, [data, filtered, isFiltered]);

  const regioesChart = useMemo(() => {
    if (!isFiltered) {
      return data.regioes.slice(0, 15).map(r => ({ cidade: r.cidade, acoes: r.totalAcoes }));
    }
    const map = new Map<string, number>();
    for (const r of filtered) if (r.cidade) map.set(r.cidade, (map.get(r.cidade) || 0) + 1);
    return Array.from(map.entries())
      .map(([cidade, acoes]) => ({ cidade, acoes }))
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 15);
  }, [data, filtered, isFiltered]);

  const kpiCards = [
    { label: "Total Registros", value: kpis.totalRegistros.toLocaleString("pt-BR"), icon: BarChart3, color: "text-primary" },
    { label: "Clientes Únicos", value: kpis.totalClientes.toLocaleString("pt-BR"), icon: Users, color: "text-accent" },
    { label: "Pipeline Total", value: formatCurrency(kpis.totalPipeline), icon: DollarSign, color: "text-warning" },
    { label: "Visitas", value: kpis.totalVisitas.toLocaleString("pt-BR"), icon: Eye, color: "text-info" },
    { label: "Consultores", value: kpis.totalConsultores.toString(), icon: TrendingUp, color: "text-chart-4" },
    { label: "Cidades", value: kpis.totalCidades.toString(), icon: MapPin, color: "text-destructive" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <KPICard
            key={kpi.label}
            title={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
          />
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução Mensal <InfoTooltip text="Por data de conclusão da ação" /></CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              series={[
                { name: "Ações", data: evolucaoFiltered.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.acoes })) },
                { name: "Visitas", data: evolucaoFiltered.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.visitas })) },
              ]}
              height={280}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 Consultores — Ações Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={topConsultores.map((c) => ({ name: c.nome, acoes: c.acoes, full: c.full }))}
              layout="horizontal"
              keys={["acoes"]}
              height={280}
              tooltipFormatter={(v) => `${v} ações`}
              onBarClick={(datum) => onSelectConsultor(String(datum.full))}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Contato</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart
              data={tiposContato.map((t): PieChartData => ({ id: t.name, name: t.name, value: t.value }))}
              height={250}
              enableLabels
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Ação</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={tiposAcao.map((t) => ({ name: t.name, value: t.value }))}
              layout="horizontal"
              keys={["value"]}
              height={250}
            />
          </CardContent>
        </Card>
      </div>

      <div className={regioesChart.length <= 6 ? "grid lg:grid-cols-2 gap-6" : ""}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Regiões por Ações Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={regioesChart.map((r) => ({ name: r.cidade, acoes: r.acoes }))}
              layout="vertical"
              keys={["acoes"]}
              height={Math.min(regioesChart.length * 45 + 40, 300)}
              tooltipFormatter={(v) => `${v} ações`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
