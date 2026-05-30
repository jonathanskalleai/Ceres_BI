import { Cpu, Users, Layers, Tag } from "lucide-react";
import { useProdutosData } from "@/hooks/bi/useProdutosData";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, PieChartWithLabels } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";

interface Props {
  active: boolean;
}

export default function ProdutosSection({ active }: Props) {
  const { agg, isLoading } = useProdutosData(active);
  const { kpis } = agg;

  return (
    <div className="space-y-6 pt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Maquinas Instaladas" value={kpis.totalMaquinas.toLocaleString("pt-BR")} icon={Cpu} loading={isLoading} hint="base instalada nos clientes" />
        <KPICard title="Clientes com Parque" value={kpis.clientesComParque.toLocaleString("pt-BR")} icon={Users} loading={isLoading} />
        <KPICard title="Grupos" value={kpis.gruposDistintos.toLocaleString("pt-BR")} icon={Layers} loading={isLoading} />
        <KPICard title="Marcas" value={kpis.marcasDistintas.toLocaleString("pt-BR")} icon={Tag} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ChartCard title="Base Instalada por Grupo" description="Quantidade de maquinas por tipo de equipamento" loading={isLoading}>
          <PieChartWithLabels
            data={agg.porGrupo.map(item => ({ id: item.name, value: item.value, name: item.name }))}
            title=""
            colors={CHART_COLORS}
          />
        </ChartCard>

        <ChartCard title="Base Instalada por Marca" description="Top 10 marcas no parque dos clientes" loading={isLoading}>
          <HorizontalBarChart
            data={agg.porMarca.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard title="Top Modelos no Parque" description="Modelos mais presentes na base instalada" loading={isLoading}>
          <HorizontalBarChart
            data={agg.topModelos.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
