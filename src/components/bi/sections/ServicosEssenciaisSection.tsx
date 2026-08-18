import { useMemo } from "react";
import { CheckCircle, Clock, FolderOpen, Timer, Wrench } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useServicosBIRpc } from "@/hooks/bi/useServicosBIRpc";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { PieChartWithLabels, VerticalBarChart } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";
import { calcTrend, formatDias, formatMonthYear, getPreviousPeriod, toISODate } from "@/lib/dateUtils";
import type { RpcServicosBI } from "@/types/biRpc";

const EMPTY: RpcServicosBI = {
  kpis: { totalOS: 0, abertas: 0, taxaFechamento: 0, tempoMedioResolucao: 0, tempoMedianoResolucao: 0, totalOcorrencias: 0 },
  porStatus: [],
  faixasResolucao: [],
  evolucaoAberturas: [],
  situacaoOcorrencias: [],
  motivosPausa: [],
  causasAtendimento: [],
};

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

/** Métricas de OS disponíveis no mirror; ocorrências e pausas sem fonte migrada não entram na composição. */
export default function ServicosEssenciaisSection({ active, dateRange }: Props) {
  const from = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const to = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);
  const { data, isLoading } = useServicosBIRpc({ from, to, enabled: active && !!from });
  const agg = data ?? EMPTY;

  const previousRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const previousFrom = useMemo(() => toISODate(previousRange?.from), [previousRange?.from]);
  const previousTo = useMemo(
    () => toISODate(previousRange?.to ?? previousRange?.from),
    [previousRange?.to, previousRange?.from],
  );
  const { data: previousData } = useServicosBIRpc({
    from: previousFrom,
    to: previousTo,
    enabled: active && !!previousFrom,
  });
  const previousKpis = (previousData ?? EMPTY).kpis;
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total OS" value={kpis.totalOS.toLocaleString("pt-BR")} icon={Wrench} loading={isLoading}
          previousValue={previousKpis.totalOS.toLocaleString("pt-BR")} trend={calcTrend(kpis.totalOS, previousKpis.totalOS)} dataSource="mirror.ordens_servico · COUNT(*) por os_dthabertura" />
        <KPICard title="OS Abertas" value={kpis.abertas.toLocaleString("pt-BR")} icon={FolderOpen} loading={isLoading} hint="backlog atual"
          previousValue={previousKpis.abertas.toLocaleString("pt-BR")} trend={calcTrend(kpis.abertas, previousKpis.abertas)} invertTrend dataSource="mirror.ordens_servico · COUNT(*) WHERE os_fstatus LIKE 'abert%'" />
        <KPICard title="Taxa de Fechamento" value={`${kpis.taxaFechamento.toFixed(1)}%`} icon={CheckCircle} loading={isLoading}
          previousValue={`${previousKpis.taxaFechamento.toFixed(1)}%`} trend={calcTrend(kpis.taxaFechamento, previousKpis.taxaFechamento)} dataSource="mirror.ordens_servico · COUNT(fechada)/COUNT(*) × 100 via os_fstatus" />
        <KPICard title="Tempo Médio de Resolução" value={formatDias(kpis.tempoMedioResolucao)} icon={Clock} loading={isLoading}
          previousValue={formatDias(previousKpis.tempoMedioResolucao)} trend={calcTrend(kpis.tempoMedioResolucao, previousKpis.tempoMedioResolucao)} invertTrend dataSource="mirror.ordens_servico · AVG(os_dthencerramento − os_dthabertura)" />
        <KPICard title="Mediana de Resolução" value={formatDias(kpis.tempoMedianoResolucao)} icon={Timer} loading={isLoading} hint="menos sensível a outliers"
          previousValue={formatDias(previousKpis.tempoMedianoResolucao)} trend={calcTrend(kpis.tempoMedianoResolucao, previousKpis.tempoMedianoResolucao)} invertTrend dataSource="mirror.ordens_servico · MEDIAN(os_dthencerramento − os_dthabertura)" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="OS por Status" description="Distribuição entre fechadas, abertas e canceladas" dataSource="mirror.ordens_servico · os_fstatus, COUNT(*)" loading={isLoading}>
          <PieChartWithLabels data={agg.porStatus.map((item) => ({ id: item.name, value: item.value, name: item.name }))} title="" colors={CHART_COLORS} />
        </ChartCard>
        <ChartCard title="Tempo de Resolução por Faixa" description="Quantas OS são resolvidas em cada janela de tempo" dataSource="mirror.ordens_servico · os_dthencerramento − os_dthabertura" loading={isLoading}>
          <VerticalBarChart data={agg.faixasResolucao.map((item) => ({ name: item.name, value: item.value }))} keys={["value"]} seriesLabels={{ value: "OS" }} title="" colors={[CHART_COLORS[0]]} />
        </ChartCard>
        <ChartCard title="Evolução Mensal de Aberturas" description="Número de OS abertas por mês" infoTooltip="Por data de abertura da OS" dataSource="mirror.ordens_servico · os_dthabertura→YYYY-MM, COUNT(*)" loading={isLoading}>
          <VerticalBarChart data={agg.evolucaoAberturas.map((item) => ({ name: formatMonthYear(item.name), value: item.value }))} keys={["value"]} seriesLabels={{ value: "OS Abertas" }} title="" colors={[CHART_COLORS[1]]} />
        </ChartCard>
      </div>
    </div>
  );
}
