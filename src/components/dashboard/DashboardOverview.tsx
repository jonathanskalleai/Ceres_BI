import { useMemo } from "react";
import { DadosComerciais } from "@/types/comercial";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, MapPin, TrendingUp, Eye, DollarSign, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, CartesianGrid, Legend,
} from "recharts";
import { Filters } from "@/types/comercial";
import { filterRegistros, filterEvolucao, hasActiveFilters } from "@/lib/filterUtils";

interface Props {
  data: DadosComerciais;
  filters: Filters;
  onSelectConsultor: (nome: string) => void;
  totalRegistrosBase?: number;
}

const CHART_COLORS = [
  "hsl(217, 91%, 60%)", "hsl(152, 69%, 40%)", "hsl(38, 92%, 50%)",
  "hsl(280, 68%, 60%)", "hsl(0, 84%, 60%)", "hsl(199, 89%, 48%)",
];

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
      <div>
        <h2 className="text-2xl font-bold text-foreground">Visão Geral</h2>
        <p className="text-sm text-muted-foreground">
          Painel de controle comercial — Campos Dealer
          {isFiltered && (
            <span className="ml-2 text-primary font-medium">(filtros ativos)</span>
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <Card key={kpi.label} className="border-0 shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
              <p className="text-2xl font-bold mt-2">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={evolucaoFiltered}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="YearMonth" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="acoes" stroke={CHART_COLORS[0]} name="Ações" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="visitas" stroke={CHART_COLORS[1]} name="Visitas" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 Consultores — Ações Concluídas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topConsultores} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="nome" tick={{ fontSize: 10 }} width={55} />
                <Tooltip formatter={(v: number) => `${v} ações`} />
                <Bar dataKey="acoes" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} cursor="pointer"
                  onClick={(d) => onSelectConsultor(d.full)} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Contato</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={tiposContato} dataKey="value" nameKey="name" cx="50%" cy="50%"
                  outerRadius={90} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  labelLine={false} fontSize={10}>
                  {tiposContato.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Ação</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={tiposAcao} layout="vertical" margin={{ left: 80 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={75} />
                <Tooltip />
                <Bar dataKey="value" fill={CHART_COLORS[1]} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Top Regiões por Ações Concluídas</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={regioesChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="cidade" tick={{ fontSize: 9 }} textAnchor="end" height={80} interval={0} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: number) => `${v} ações`} />
              <Bar dataKey="acoes" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
};
