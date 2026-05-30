import { Wrench, AlertCircle, CheckCircle, Clock, Timer, FolderOpen } from "lucide-react";
import { useServicosData } from "@/hooks/bi/useServicosData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { NivoHorizontalBarChart, NivoVerticalBarChart } from "@/components/bi/nivo/NivoBarChart";
import { NivoPieChartWithLabels } from "@/components/bi/nivo/NivoPieChart";
import { NIVO_COLORS } from "@/lib/nivoTheme";
import { formatDias } from "@/lib/dateUtils";

interface Props {
  active: boolean;
}

export default function ServicosSection({ active }: Props) {
  const { agg, isLoading } = useServicosData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Total OS" value={kpis.totalOS.toLocaleString("pt-BR")} icon={Wrench} loading={isLoading} />
        <KPICard title="OS Abertas" value={kpis.abertas.toLocaleString("pt-BR")} icon={FolderOpen} loading={isLoading} hint="backlog atual" />
        <KPICard title="Taxa de Fechamento" value={`${kpis.taxaFechamento.toFixed(1)}%`} icon={CheckCircle} loading={isLoading} />
        <KPICard title="Tempo Medio Resolucao" value={formatDias(kpis.tempoMedioResolucao)} icon={Clock} loading={isLoading} />
        <KPICard title="Mediana Resolucao" value={formatDias(kpis.tempoMedianoResolucao)} icon={Timer} loading={isLoading} hint="menos sensivel a outliers" />
        <KPICard title="Total Ocorrencias" value={kpis.totalOcorrencias.toLocaleString("pt-BR")} icon={AlertCircle} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="OS por Status" description="Distribuicao entre fechadas, abertas e canceladas" loading={isLoading}>
          <NivoPieChartWithLabels
            data={agg.porStatus.map(item => ({ id: item.name, value: item.value, name: item.name }))}
            title=""
            colors={NIVO_COLORS}
          />
        </ChartCard>

        <ChartCard title="Tempo de Resolucao por Faixa" description="Quantas OS sao resolvidas em cada janela de tempo" loading={isLoading}>
          <NivoVerticalBarChart
            data={agg.faixasResolucao.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[0]]}
          />
        </ChartCard>

        <ChartCard title="Evolucao Mensal de Aberturas" description="Numero de OS abertas por mes" loading={isLoading}>
          <NivoVerticalBarChart
            data={agg.evolucaoAberturas.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard title="Atividade de Campo — Ocorrencias" description="Deslocamento, atendimento e pausas registradas pelos tecnicos" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.situacaoOcorrencias.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[2]]}
          />
        </ChartCard>

        <ChartCard title="Motivos de Pausa" description="Gargalos operacionais (ex: aguardando pecas)" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.motivosPausa.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[5]]}
          />
        </ChartCard>

        <ChartCard title="Causas de Atendimento Mais Comuns" description="Principais motivos de chamado tecnico" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.causasAtendimento.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[3]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
