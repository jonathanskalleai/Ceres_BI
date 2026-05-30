import { Users, Route, Activity, Coffee, Calendar, CheckCircle } from "lucide-react";
import { useOperacionalData } from "@/hooks/bi/useOperacionalData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { NivoHorizontalBarChart, NivoVerticalBarChart } from "@/components/bi/nivo/NivoBarChart";
import NivoPieChart, { NivoPieChartWithLabels } from "@/components/bi/nivo/NivoPieChart";
import { NIVO_COLORS, POSITIVE_COLOR, NEGATIVE_COLOR } from "@/lib/nivoTheme";

interface Props {
  active: boolean;
}

const pct = (v: number) => `${v.toFixed(1)}%`;

export default function OperacionalSection({ active }: Props) {
  const { agg, isLoading } = useOperacionalData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <KPICard title="Tecnicos Ativos" value={kpis.tecnicosAtivos.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="KM Rodado" value={kpis.kmTotal.toLocaleString("pt-BR")} icon={Route} loading={isLoading} hint="total da frota tecnica" />
        <KPICard title="Utilizacao Media" value={pct(kpis.utilizacaoMedia)} icon={Activity} loading={isLoading} hint="atendimento + deslocamento" />
        <KPICard title="Tempo Ocioso" value={pct(kpis.percentOcioso)} icon={Coffee} loading={isLoading} hint="% do tempo disponivel" />
        <KPICard title="Eventos Agenda" value={kpis.eventosAgenda.toLocaleString("pt-BR")} icon={Calendar} loading={isLoading} />
        <KPICard title="Conclusao Agenda" value={pct(kpis.taxaConclusaoAgenda)} icon={CheckCircle} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard
          title="Utilizacao por Tecnico"
          description="% do tempo em atendimento, deslocamento e ocioso"
          loading={isLoading}
          height={300}
        >
          <NivoHorizontalBarChart
            data={agg.utilizacaoPorTecnico}
            keys={['atendimento', 'deslocamento', 'ocioso']}
            title=""
            tooltipFormatter={(v: number) => `${Math.round(v)}%`}
            colors={[POSITIVE_COLOR, NIVO_COLORS[1], NEGATIVE_COLOR]}
          />
        </ChartCard>

        <ChartCard title="KM Rodado por Tecnico" description="Distancia percorrida em atendimentos de campo" loading={isLoading} height={300}>
          <NivoHorizontalBarChart
            data={agg.kmPorTecnico.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            tooltipFormatter={(v: number) => `${v.toLocaleString("pt-BR")} km`}
            colors={[NIVO_COLORS[3]]}
          />
        </ChartCard>

        <ChartCard title="Agenda por Status" description="Situacao dos agendamentos de servico" loading={isLoading}>
          <NivoPieChartWithLabels
            data={agg.agendaPorStatus.map(item => ({ id: item.name, value: item.value, name: item.name }))}
            title=""
            colors={NIVO_COLORS}
          />
        </ChartCard>

        <ChartCard title="Agenda por Tipo de Servico" description="Tipos de atendimento agendados" loading={isLoading}>
          <NivoHorizontalBarChart
            data={agg.agendaPorTipo.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[NIVO_COLORS[2]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
