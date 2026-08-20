import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtBRLKpi, fmtPct } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { TicketMedioPorFormaEntradaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: TicketMedioPorFormaEntradaItem[];
  loading?: boolean;
}

const SEQUENTIAL_BLUE = [
  "#2a78d6", "#3987e5", "#5598e7", "#6da7ec",
  "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb",
];

export function TicketMedioPorFormaEntrada({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: item.forma,
    ticket_medio: item.ticket_medio,
    valor_ganho: item.valor_ganho,
  }));

  const chartH = Math.min(400, Math.max(220, data.length * 40 + 40));

  return (
    <ChartCard
      title="Ticket Médio por Forma de Entrada"
      description="Origem dos negócios ordenados por ticket médio. Ordenado por ticket_medio DESC."
      loading={loading}
      height={chartH}
      footer={
        <div className="text-[10px] text-[var(--voux-text-muted)] font-mono">
          Forma de entrada = como o negócio chegou (visita, campanha, telefone, etc.)
        </div>
      }
    >
      <HorizontalBarChart
        data={chartData}
        keys={["ticket_medio"]}
        height={chartH}
        itemColors={SEQUENTIAL_BLUE}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => d.forma === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">Ticket médio: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.ticket_medio)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Valor ganho: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_ganho)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Negócios: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.negocios)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Taxa conv.: <strong style="color:var(--voux-tooltip-text)">${fmtPct(item.taxa_conversao)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
