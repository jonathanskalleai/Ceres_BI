import { useMemo } from "react";
import { ClipboardList, MapPin, Users, Eye, UserCheck, Tag } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, VerticalBarChart, PieChartWithLabels } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";
import { toISODate, getPreviousPeriod, calcTrend } from "@/lib/dateUtils";
import type { RpcAcoesBI } from "@/types/biRpc";

const EMPTY: RpcAcoesBI = {
  kpis: { totalAcoes: 0, cidades: 0, consultores: 0, visitas: 0, clientes: 0, tiposAcaoDistintos: 0 },
  porVendedor: [], porCidade: [], porMes: [], porDiaSemana: [],
  porTipoAcao: [], porTipoContato: [], listaAnos: [],
};

interface Props {
  active: boolean;
  dateRange?: DateRange;
  categoria?: string;
  funil?: string;
}

export default function AcoesSection({ active, dateRange, categoria, funil }: Props) {
  const { vendedor, cidade } = useNegociosFilter();

  const from = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const to = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);

  const { data, isLoading } = useAcoesBIRpc({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active,
  });

  // Periodo anterior (mesmo intervalo, 1 ano atras) para analise comparativa
  const prevRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const fromPrev = useMemo(() => toISODate(prevRange?.from), [prevRange?.from]);
  const toPrev = useMemo(() => toISODate(prevRange?.to ?? prevRange?.from), [prevRange?.to, prevRange?.from]);
  const { data: dataPrev } = useAcoesBIRpc({
    from: fromPrev,
    to: toPrev,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: active && !!fromPrev,
  });

  const { kpis, porVendedor, porCidade, porMes, porDiaSemana, porTipoAcao, porTipoContato } = data ?? EMPTY;
  const kpisPrev = (dataPrev ?? EMPTY).kpis;

  return (
    <div className="space-y-6 pt-2">


      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total de Acoes" value={kpis.totalAcoes.toLocaleString("pt-BR")} icon={ClipboardList} loading={isLoading}
          previousValue={kpisPrev.totalAcoes.toLocaleString("pt-BR")} trend={calcTrend(kpis.totalAcoes, kpisPrev.totalAcoes)} />
        <KPICard title="Cidades Atendidas" value={kpis.cidades.toLocaleString("pt-BR")} icon={MapPin} loading={isLoading}
          previousValue={kpisPrev.cidades.toLocaleString("pt-BR")} trend={calcTrend(kpis.cidades, kpisPrev.cidades)} />
        <KPICard title="Consultores Ativos" value={kpis.consultores.toLocaleString("pt-BR")} icon={Users} loading={isLoading}
          previousValue={kpisPrev.consultores.toLocaleString("pt-BR")} trend={calcTrend(kpis.consultores, kpisPrev.consultores)} />
        <KPICard title="Total de Visitas" value={kpis.visitas.toLocaleString("pt-BR")} icon={Eye} loading={isLoading}
          previousValue={kpisPrev.visitas.toLocaleString("pt-BR")} trend={calcTrend(kpis.visitas, kpisPrev.visitas)} />
        <KPICard title="Clientes Unicos" value={kpis.clientes.toLocaleString("pt-BR")} icon={UserCheck} loading={isLoading}
          previousValue={kpisPrev.clientes.toLocaleString("pt-BR")} trend={calcTrend(kpis.clientes, kpisPrev.clientes)} />
        <KPICard title="Tipos de Acao" value={kpis.tiposAcaoDistintos.toLocaleString("pt-BR")} icon={Tag} loading={isLoading}
          previousValue={kpisPrev.tiposAcaoDistintos.toLocaleString("pt-BR")} trend={calcTrend(kpis.tiposAcaoDistintos, kpisPrev.tiposAcaoDistintos)} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Acoes por Consultor" description="Top 15 por volume" loading={isLoading}>
          <HorizontalBarChart
            data={porVendedor.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Acoes" description="Quantidade por mes" loading={isLoading}>
          <VerticalBarChart
            data={porMes.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Acoes por Cidade" description="Top 15 cidades" loading={isLoading}>
          <HorizontalBarChart
            data={porCidade.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Distribuicao por Tipo de Acao" description="Proporcao de cada tipo" loading={isLoading}>
          <PieChartWithLabels data={porTipoAcao} title="" />
        </ChartCard>

        <ChartCard title="Acoes por Dia da Semana" description="Concentracao semanal" loading={isLoading}>
          <VerticalBarChart
            data={porDiaSemana.map((d) => ({ name: d.name, acoes: d.acoes }))}
            keys={["acoes"]}
            seriesLabels={{ acoes: "Ações" }}
            title=""
            colors={[CHART_COLORS[4]]}
          />
        </ChartCard>

        <ChartCard title="Tipo de Contato" description="Distribuicao dos canais" loading={isLoading}>
          <PieChartWithLabels data={porTipoContato} title="" />
        </ChartCard>
      </div>
    </div>
  );
}
