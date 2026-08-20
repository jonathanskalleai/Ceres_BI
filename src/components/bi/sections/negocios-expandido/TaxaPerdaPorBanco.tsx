import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtPct } from "@/lib/formatters";
import { fmtBRLKpi } from "@/lib/formatters";
import type { TaxaPerdaPorBancoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: TaxaPerdaPorBancoItem[];
  loading?: boolean;
}

// Amber → red diverging for high loss rates
const DIVERGING_PALETTE = [
  "#d4a05a", "#c97565", "#b83a3a",
  "#e06060", "#d95926", "#eb6834",
  "#f0a060", "#c87565", "#b06060",
];

export function TaxaPerdaPorBanco({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: item.banco,
    taxa_perda: item.taxa_perda,
    valor_perdido: item.valor_perdido,
  }));

  const chartH = Math.min(400, Math.max(220, data.length * 40 + 40));

  return (
    <ChartCard
      title="Taxa de Perda por Banco Financiador"
      description="Bancos com maior taxa de perda (ordenados do maior para o menor)."
      loading={loading}
      height={chartH}
    >
      <HorizontalBarChart
        data={chartData}
        keys={["taxa_perda"]}
        height={chartH}
        itemColors={DIVERGING_PALETTE}
        tooltipFormatter={(v) => fmtPct(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => d.banco === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">Taxa perda: <strong style="color:var(--voux-tooltip-text)">${fmtPct(item.taxa_perda)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Valor perdido: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_perdido)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Perdidos/Total: <strong style="color:var(--voux-tooltip-text)">${item.perdidos} / ${item.total}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
