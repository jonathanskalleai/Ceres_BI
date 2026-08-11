import { ChartCard } from "@/components/bi/ChartCard";
import { LineChart, BarChart, PieChart } from "@/components/bi/charts";
import type { PieChartData } from "@/components/bi/charts";
import { SectionEyebrow } from "@/components/bi/SectionEyebrow";
import { formatMonthYear } from "@/lib/dateUtils";
import { CHART_COLORS } from "@/lib/chartTheme";
import type { EvolucaoMensal, RegiaoVendedor } from "@/types/comercial";

interface Props {
  evolucao: EvolucaoMensal[];
  tiposAcao: Record<string, number>;
  regioes: RegiaoVendedor[];
}

export function ConsultorCharts({ evolucao, tiposAcao, regioes }: Props) {
  const tiposAcaoData = Object.entries(tiposAcao).map(([name, value]) => ({ name, value }));

  return (
    <div className="space-y-4">
      <SectionEyebrow label="Análise de Performance" />

      <div className="grid lg:grid-cols-2 gap-4">
        <ChartCard
          title="Evolução Mensal"
          description="Ações e visitas por mês (data de conclusão)"
          label="TENDÊNCIA"
          height={260}
        >
          <LineChart
            series={[
              { name: "Ações", data: evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.acoes })) },
              { name: "Visitas", data: evolucao.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.visitas })) },
            ]}
            height={260}
          />
        </ChartCard>

        <ChartCard
          title="Tipos de Ação"
          description="Distribuição proporcional por tipo"
          label="COMPOSIÇÃO"
          height={260}
        >
          <PieChart
            data={tiposAcaoData.map((t): PieChartData => ({ id: t.name, name: t.name, value: t.value }))}
            height={260}
            enableLabels
          />
        </ChartCard>
      </div>

      {regioes.length > 0 && (
        <ChartCard
          title="Regiões de Atuação"
          description="Top 10 cidades por volume de ações"
          label="GEOGRÁFICO"
          height={220}
        >
          <BarChart
            data={regioes.map((r) => ({ name: r.cidade, acoes: r.acoes }))}
            layout="vertical"
            keys={["acoes"]}
            height={220}
            tooltipFormatter={(val) => `${val} ações`}
          />
        </ChartCard>
      )}
    </div>
  );
}
