import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { ValorPorCidadeItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ValorPorCidadeItem[];
  loading?: boolean;
}

const SEQUENTIAL_SLATE = [
  "#4a6b8a", "#5d7d9c", "#708fae", "#8ea3b8",
  "#a4b7c8", "#bacbd8", "#d0dfe8", "#e5eff5",
];

export function ValorPorCidade({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: `${item.cidade} (${item.uf})`,
    valor_ganho: item.valor_ganho,
    negocios: item.negocios,
  }));

  const chartH = Math.min(500, Math.max(260, data.length * 36 + 40));

  return (
    <ChartCard
      title="Valor Ganho por Cidade"
      description="TOP 30 cidades por valor de negócio ganho no período."
      loading={loading}
      height={chartH}
    >
      <HorizontalBarChart
        data={chartData}
        keys={["valor_ganho"]}
        height={chartH}
        itemColors={SEQUENTIAL_SLATE}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => `${d.cidade} (${d.uf})` === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${item.cidade} (${item.uf})</div>
            <div style="color:var(--voux-tooltip-muted)">Valor ganho: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_ganho)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Negócios: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.negocios)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
