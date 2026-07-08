import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { KPICard } from "@/components/bi/KPICard";
import { Users, MapPin, TrendingUp, Eye, DollarSign, BarChart3 } from "lucide-react";
import { BarChart, LineChart, PieChart } from "@/components/bi/charts";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { PieChartData } from "@/components/bi/charts";
import { formatMonthYear, toISODate } from "@/lib/dateUtils";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { useNavigate } from "react-router-dom";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import {
  useKpisComercial,
  useRankingVendedores,
  useEvolucaoMensal,
  useRankingRegioes,
} from "@/hooks/useComercialRpc";

const formatCurrency = (v: number) =>
  v >= 1e6 ? `R$ ${(v / 1e6).toFixed(1)}M` : `R$ ${(v / 1e3).toFixed(0)}K`;

/**
 * CrmOverviewRpc — replaces browser-side aggregation with server-side RPCs.
 * Uses the same visual layout as DashboardOverview but fetches pre-aggregated data.
 */
export default function CrmOverviewRpc() {
  const { dateRange } = useNegociosFilter();
  const navigate = useNavigate();

  // Fallback: se dateRange vem undefined momentaneamente, usar mes atual
  const fallbackFrom = useMemo(() => startOfMonth(new Date()), []);
  const fallbackTo = useMemo(() => endOfMonth(new Date()), []);
  const from = toISODate(dateRange?.from ?? fallbackFrom) ?? "";
  const to = toISODate(dateRange?.to ?? fallbackTo) ?? "";
  const hasDateRange = !!from && !!to;

  // Evolucao mensal: janela fixa de 12 meses rolling (RPC ignora p_from/p_to,
  // mas precisamos de strings validas para o hook nao se desabilitar)
  const evoFrom = useMemo(
    () => format(subMonths(startOfMonth(new Date()), 11), "yyyy-MM-dd"),
    [],
  );
  const evoTo = useMemo(() => format(new Date(), "yyyy-MM-dd"), []);

  // ─── RPC hooks ───────────────────────────────────────────────────────
  const { data: kpisRaw, isLoading: kpisLoading } = useKpisComercial({
    from, to, enabled: hasDateRange,
  });
  const { data: rankingVendedores, isLoading: rankLoading } = useRankingVendedores({
    from, to, limit: 10, enabled: hasDateRange,
  });
  const { data: evolucao, isLoading: evolLoading } = useEvolucaoMensal({
    from: evoFrom, to: evoTo, enabled: true,
  });
  const { data: regioes, isLoading: regLoading } = useRankingRegioes({
    from, to, limit: 15, enabled: hasDateRange,
  });

  // ─── Derived chart data ──────────────────────────────────────────────
  const kpiCards = useMemo(() => {
    if (!kpisRaw) return [];
    return [
      { label: "Total Registros", value: kpisRaw.totalRegistros.toLocaleString("pt-BR"), icon: BarChart3 },
      { label: "Clientes Unicos", value: kpisRaw.totalClientes.toLocaleString("pt-BR"), icon: Users },
      { label: "Pipeline Total", value: formatCurrency(kpisRaw.totalPipeline), icon: DollarSign },
      { label: "Visitas", value: kpisRaw.totalVisitas.toLocaleString("pt-BR"), icon: Eye },
      { label: "Consultores", value: kpisRaw.totalConsultores.toString(), icon: TrendingUp },
      { label: "Cidades", value: kpisRaw.totalCidades.toString(), icon: MapPin },
    ];
  }, [kpisRaw]);

  const tiposContato = useMemo((): PieChartData[] => {
    if (!kpisRaw?.tiposContato) return [];
    return Object.entries(kpisRaw.tiposContato).map(([name, value]) => ({
      id: name, name, value,
    }));
  }, [kpisRaw]);

  const tiposAcao = useMemo(() => {
    if (!kpisRaw?.tiposAcao) return [];
    return Object.entries(kpisRaw.tiposAcao)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value]) => ({ name, value }));
  }, [kpisRaw]);

  const topConsultores = useMemo(() => {
    if (!rankingVendedores) return [];
    return rankingVendedores.map((v) => ({
      nome: v.vendedor.split(" ").slice(-1)[0],
      acoes: v.acoes,
      full: v.vendedor,
    }));
  }, [rankingVendedores]);

  const evolucaoChart = useMemo(() => {
    if (!evolucao) return [];
    return evolucao.slice(-12);
  }, [evolucao]);

  /** Short month label for chart X axis: "jul/2026" → "jul/26" */
  const fmtShort = (ym: string) => formatMonthYear(ym).replace(/\/20(\d{2})$/, "/$1");

  const regioesChart = useMemo(() => {
    if (!regioes) return [];
    return regioes.map((r) => ({ cidade: r.cidade, acoes: r.acoes }));
  }, [regioes]);

  // ─── Render ──────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <KPICard
            key={kpi.label}
            title={kpi.label}
            value={kpi.value}
            icon={kpi.icon}
            loading={kpisLoading}
          />
        ))}
        {kpisLoading && kpiCards.length === 0 &&
          Array.from({ length: 6 }).map((_, i) => (
            <KPICard key={i} title="" value="" loading />
          ))
        }
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Evolucao Mensal <InfoTooltip text="Por data de conclusao da acao" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LineChart
              series={[
                { name: "Acoes", data: evolucaoChart.map((d) => ({ x: fmtShort(d.mes), y: d.acoes })) },
                { name: "Visitas", data: evolucaoChart.map((d) => ({ x: fmtShort(d.mes), y: d.visitas })) },
              ]}
              height={280}
              loading={evolLoading}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top 10 Consultores — Acoes Concluidas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={topConsultores.map((c) => ({ name: c.nome, acoes: c.acoes, full: c.full }))}
              layout="horizontal"
              keys={["acoes"]}
              height={280}
              loading={rankLoading}
              tooltipFormatter={(v) => `${v} acoes`}
              onBarClick={(datum) => navigate(`/crm/consultores/${encodeURIComponent(String(datum.full))}`)}
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Contato</CardTitle>
          </CardHeader>
          <CardContent className="flex justify-center">
            <PieChart
              data={tiposContato}
              height={250}
              loading={kpisLoading}
              enableLabels
            />
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tipos de Acao</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={tiposAcao.map((t) => ({ name: t.name, value: t.value }))}
              layout="horizontal"
              keys={["value"]}
              height={250}
              loading={kpisLoading}
            />
          </CardContent>
        </Card>
      </div>

      <div className={regioesChart.length <= 6 ? "grid lg:grid-cols-2 gap-6" : ""}>
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Top Regioes por Acoes Concluidas</CardTitle>
          </CardHeader>
          <CardContent>
            <BarChart
              data={regioesChart.map((r) => ({ name: r.cidade, acoes: r.acoes }))}
              layout="vertical"
              keys={["acoes"]}
              height={Math.min(regioesChart.length * 45 + 40, 300)}
              loading={regLoading}
              tooltipFormatter={(v) => `${v} acoes`}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
