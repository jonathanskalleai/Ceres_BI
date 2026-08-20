import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { PieChart, type PieChartData } from "@/components/bi/charts";
import { fmtBRLKpi } from "@/lib/formatters";
import type { DistribuicaoPorGrupoProdutoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: DistribuicaoPorGrupoProdutoItem[];
  loading?: boolean;
}

export function DistribuicaoPorGrupoProduto({ data, loading }: Props) {
  const chartData: PieChartData[] = useMemo(
    () =>
      data.map((item) => ({
        id: item.grupo,
        name: item.grupo,
        value: item.valor_ganho,
      })),
    [data],
  );

  return (
    <ChartCard
      title="Distribuição por Grupo de Produto"
      description="Participação de cada grupo de produto no valor total ganho."
      loading={loading}
      height={Math.min(400, Math.max(280, data.length * 48 + 100))}
    >
      <PieChart
        data={chartData}
        height={Math.min(380, Math.max(240, data.length * 40 + 60))}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
      />
    </ChartCard>
  );
}
