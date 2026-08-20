import { ChartCard } from "@/components/bi/ChartCard";
import { HorizontalBarChart, type BarChartData } from "@/components/bi/charts";
import { fmtBRLKpi } from "@/lib/formatters";
import { fmtNum } from "@/lib/formatters";
import type { VolumePorTipoClienteItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: VolumePorTipoClienteItem[];
  loading?: boolean;
}

const TYPE_COLORS = ["#4caf7a", "#d4a05a", "#8ea3b8", "#c97565"];

export function VolumePorTipoCliente({ data, loading }: Props) {
  const chartData: BarChartData[] = data.map((item) => ({
    name: item.tipo,
    valor_total: item.valor_total,
    valor_ganho: item.valor_ganho,
    ticket_medio_ganho: item.ticket_medio_ganho ?? 0,
  }));

  const chartH = Math.min(300, Math.max(180, data.length * 52 + 60));

  return (
    <ChartCard
      title="Volume por Tipo de Cliente (PF vs. PJ)"
      description="Pessoa Física vs. Jurídica: volume total, valor ganho e ticket médio."
      loading={loading}
      height={chartH}
      footer={
        <div className="space-y-1">
          {data.map((item) => (
            <div key={item.tipo} className="flex justify-between text-[11px] font-mono">
              <span className="text-[var(--voux-text-muted)]">{item.tipo}</span>
              <div className="flex gap-4">
                <span>
                  {fmtNum(item.negocios)} neg /{" "}
                  <strong className="text-[var(--voux-text-primary)]">{fmtNum(item.ganhos)}</strong> ganhos
                </span>
                <span className="text-[var(--voux-text-secondary)]">
                  Ticket: <strong className="text-[var(--voux-text-primary)]">{fmtBRLKpi(item.ticket_medio_ganho ?? 0)}</strong>
                </span>
              </div>
            </div>
          ))}
        </div>
      }
    >
      <HorizontalBarChart
        data={chartData}
        keys={["valor_total"]}
        height={chartH}
        itemColors={TYPE_COLORS}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
        tooltipContentFormatter={(datum, _value, _keyLabel) => {
          const item = data.find((d) => d.tipo === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">Valor total: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_total)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Valor ganho: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.valor_ganho)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Negócios/Ganhos: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.negocios)}/${fmtNum(item.ganhos)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Ticket médio: <strong style="color:var(--voux-tooltip-text)">${fmtBRLKpi(item.ticket_medio_ganho ?? 0)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
