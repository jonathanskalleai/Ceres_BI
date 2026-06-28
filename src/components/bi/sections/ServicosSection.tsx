import { useMemo } from "react";
import { Wrench, AlertCircle, CheckCircle, Clock, Timer, FolderOpen } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useServicosBIRpc } from "@/hooks/bi/useServicosBIRpc";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, VerticalBarChart, PieChartWithLabels } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";
import { formatDias, formatMonthYear, toISODate, getPreviousPeriod, calcTrend } from "@/lib/dateUtils";
import type { RpcServicosBI } from "@/types/biRpc";

const EMPTY: RpcServicosBI = {
  kpis: { totalOS: 0, abertas: 0, taxaFechamento: 0, tempoMedioResolucao: 0, tempoMedianoResolucao: 0, totalOcorrencias: 0 },
  porStatus: [], faixasResolucao: [], evolucaoAberturas: [],
  situacaoOcorrencias: [], motivosPausa: [], causasAtendimento: [],
};

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

export default function ServicosSection({ active, dateRange }: Props) {
  const from = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const to = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);

  const { data, isLoading } = useServicosBIRpc({ from, to, enabled: active && !!from });
  const agg = data ?? EMPTY;
  const { kpis } = agg;

  // Periodo anterior (mesmo intervalo, 1 ano atras) para analise comparativa
  const prevRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);
  const fromPrev = useMemo(() => toISODate(prevRange?.from), [prevRange?.from]);
  const toPrev = useMemo(() => toISODate(prevRange?.to ?? prevRange?.from), [prevRange?.to, prevRange?.from]);
  const { data: dataPrev } = useServicosBIRpc({ from: fromPrev, to: toPrev, enabled: active && !!fromPrev });
  const kpisPrev = (dataPrev ?? EMPTY).kpis;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total OS" value={kpis.totalOS.toLocaleString("pt-BR")} icon={Wrench} loading={isLoading}
          previousValue={kpisPrev.totalOS.toLocaleString("pt-BR")} trend={calcTrend(kpis.totalOS, kpisPrev.totalOS)} dataSource="mirror.ordens_servico · COUNT(*) por os_dthabertura" />
        <KPICard title="OS Abertas" value={kpis.abertas.toLocaleString("pt-BR")} icon={FolderOpen} loading={isLoading} hint="backlog atual"
          previousValue={kpisPrev.abertas.toLocaleString("pt-BR")} trend={calcTrend(kpis.abertas, kpisPrev.abertas)} invertTrend dataSource="mirror.ordens_servico · COUNT(*) WHERE os_fstatus LIKE 'abert%'" />
        <KPICard title="Taxa de Fechamento" value={`${kpis.taxaFechamento.toFixed(1)}%`} icon={CheckCircle} loading={isLoading}
          previousValue={`${kpisPrev.taxaFechamento.toFixed(1)}%`} trend={calcTrend(kpis.taxaFechamento, kpisPrev.taxaFechamento)} dataSource="mirror.ordens_servico · COUNT(fechada)/COUNT(*) × 100 via os_fstatus" />
        <KPICard title="Tempo Medio Resolucao" value={formatDias(kpis.tempoMedioResolucao)} icon={Clock} loading={isLoading}
          previousValue={formatDias(kpisPrev.tempoMedioResolucao)} trend={calcTrend(kpis.tempoMedioResolucao, kpisPrev.tempoMedioResolucao)} invertTrend dataSource="mirror.ordens_servico · AVG(os_dthencerramento − os_dthabertura)" />
        <KPICard title="Mediana Resolucao" value={formatDias(kpis.tempoMedianoResolucao)} icon={Timer} loading={isLoading} hint="menos sensivel a outliers"
          previousValue={formatDias(kpisPrev.tempoMedianoResolucao)} trend={calcTrend(kpis.tempoMedianoResolucao, kpisPrev.tempoMedianoResolucao)} invertTrend dataSource="mirror.ordens_servico · MEDIAN(os_dthencerramento − os_dthabertura)" />
        <KPICard title="Total Ocorrencias" value={kpis.totalOcorrencias.toLocaleString("pt-BR")} icon={AlertCircle} loading={isLoading}
          previousValue={kpisPrev.totalOcorrencias.toLocaleString("pt-BR")} trend={calcTrend(kpis.totalOcorrencias, kpisPrev.totalOcorrencias)} dataSource="⚠ dados não migrados — sempre retorna 0" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="OS por Status" description="Distribuicao entre fechadas, abertas e canceladas" dataSource="mirror.ordens_servico · os_fstatus, COUNT(*)" loading={isLoading}>
          <PieChartWithLabels
            data={agg.porStatus.map(item => ({ id: item.name, value: item.value, name: item.name }))}
            title=""
            colors={CHART_COLORS}
          />
        </ChartCard>

        <ChartCard title="Tempo de Resolucao por Faixa" description="Quantas OS sao resolvidas em cada janela de tempo" dataSource="mirror.ordens_servico · os_dthencerramento − os_dthabertura (faixas 0-3, 4-7, 8-15, 16-30, 30+ dias)" loading={isLoading}>
          <VerticalBarChart
            data={agg.faixasResolucao.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "OS" }}
            title=""
            colors={[CHART_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Aberturas" description="Numero de OS abertas por mes" infoTooltip="Por data de abertura da OS" dataSource="mirror.ordens_servico · os_dthabertura→YYYY-MM, COUNT(*)" loading={isLoading}>
          <VerticalBarChart
            data={agg.evolucaoAberturas.map(item => ({ name: formatMonthYear(item.name), value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "OS Abertas" }}
            title=""
            colors={[CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard title="Atividade de Campo — Ocorrencias" description="Deslocamento, atendimento e pausas registradas pelos tecnicos" dataSource="⚠ dados não migrados — sempre []" loading={isLoading}>
          <HorizontalBarChart
            data={agg.situacaoOcorrencias.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Ocorrências" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Motivos de Pausa" description="Gargalos operacionais (ex: aguardando pecas)" dataSource="⚠ dados não migrados — sempre []" loading={isLoading}>
          <HorizontalBarChart
            data={agg.motivosPausa.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Pausas" }}
            title=""
            colors={[CHART_COLORS[5]]}
          />
        </ChartCard>

        <ChartCard title="Causas de Atendimento Mais Comuns" description="Principais motivos de chamado tecnico" dataSource="⚠ dados não migrados — sempre []" loading={isLoading}>
          <HorizontalBarChart
            data={agg.causasAtendimento.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Chamados" }}
            title=""
            colors={[CHART_COLORS[3]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
