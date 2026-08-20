import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtBRLKpi, fmtPct } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { TaxaFechamentoPorMotivoGanhoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: TaxaFechamentoPorMotivoGanhoItem[];
  loading?: boolean;
}

const SEQUENTIAL_AMBER = [
  "#8c5e1a", "#a67322", "#bf8a2e", "#d4a05a",
  "#e0b574", "#ebc98e", "#f2dba8", "#f8edc3",
];

export function TaxaFechamentoPorMotivoGanho({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: item.motivo,
    valor_ganho: item.valor_ganho,
    taxa_conversao: item.taxa_conversao,
  }));

  const chartH = Math.min(400, Math.max(220, data.length * 40 + 40));

  return (
    <ChartCard
      title="Taxa de Fechamento por Motivo de Ganho"
      description="Motivos mais frequentes com maior valor ganho. Barra = valor; tooltip = taxa de conversão."
      loading={loading}
      height={chartH}
    >
      <HorizontalBarChart
        data={chartData}
        keys={["valor_ganho"]}
        height={chartH}
        itemColors={SEQUENTIAL_AMBER}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => d.motivo === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">Valor ganho: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_ganho)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Taxa conv.: <strong style="color:var(--voux-tooltip-text)">${fmtPct(item.taxa_conversao)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Total fechamentos: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.total)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Ganhos: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.ganhos)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
