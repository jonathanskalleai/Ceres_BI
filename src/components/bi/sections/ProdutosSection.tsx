import { Cpu, Users, Layers, Tag } from "lucide-react";
import { type DateRange } from "react-day-picker";
import { useProdutosBIRpc } from "@/hooks/bi/useProdutosBIRpc";
import { useQueryClient } from "@tanstack/react-query";
import { KPICard } from "@/components/bi/KPICard";
import { ChartCard } from "@/components/bi/ChartCard";
import { BiErrorState } from "@/components/bi/BiErrorState";
import { HorizontalBarChart, PieChartWithLabels } from "@/components/bi/charts";
import { CHART_COLORS } from "@/lib/chartTheme";

interface Props {
  active: boolean;
  dateRange?: DateRange;
}

export default function ProdutosSection({ active, dateRange }: Props) {
  const { data, isLoading, error } = useProdutosBIRpc(active);
  const queryClient = useQueryClient();
  const { kpis } = data;

  if (error && !isLoading) {
    return (
      <div className="pt-4">
        <BiErrorState
          message="Erro ao carregar dados de produtos"
          onRetry={() => queryClient.invalidateQueries({ queryKey: ["bi-produtos-rpc"] })}
        />
      </div>
    );
  }

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
            data={data.porGrupo.map(item => ({ id: item.name, value: item.value, name: item.name }))}
            title=""
            colors={CHART_COLORS}
          />
        </ChartCard>

        <ChartCard title="Base Instalada por Marca" description="Top 10 marcas no parque dos clientes" loading={isLoading}>
          <HorizontalBarChart
            data={data.porMarca.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Máquinas" }}
            title=""
            colors={[CHART_COLORS[1]]}
          />
        </ChartCard>

        <ChartCard title="Top Modelos no Parque" description="Modelos mais presentes na base instalada" loading={isLoading}>
          <HorizontalBarChart
            data={data.topModelos.map(item => ({ name: item.name, value: item.value }))}
            keys={['value']}
            seriesLabels={{ value: "Máquinas" }}
            title=""
            colors={[CHART_COLORS[2]]}
          />
        </ChartCard>
      </div>
    </div>
  );
}
