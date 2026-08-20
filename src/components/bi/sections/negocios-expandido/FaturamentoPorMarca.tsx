import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { FaturamentoPorMarcaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: FaturamentoPorMarcaItem[];
  loading?: boolean;
}

const SEQUENTIAL_BLUE = [
  "#2a78d6", "#3987e5", "#5598e7", "#6da7ec",
  "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb",
];

export function FaturamentoPorMarca({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: item.marca,
    valor: item.valor,
    negocios: item.negocios,
  }));

  return (
    <ChartCard
      title="Faturamento Ganho por Marca de Produto"
      description="TOP 12 marcas por valor de negócio ganho no período."
      loading={loading}
      height={Math.min(400, Math.max(220, data.length * 40 + 40))}
    >
      <HorizontalBarChart
        data={chartData}
        keys={["valor"]}
        height={Math.min(400, Math.max(220, data.length * 40 + 40))}
        itemColors={SEQUENTIAL_BLUE}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => d.marca === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">Valor: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Negócios: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.negocios)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
