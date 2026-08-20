import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { StackedBarChart, type BarChartData } from "@/components/bi/charts";
import { formatDias } from "@/lib/dateUtils";
import { fmtNum } from "@/lib/formatters";
import type { CicloVendasPorEtapaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: CicloVendasPorEtapaItem[];
  loading?: boolean;
}

const GAIN_COLOR = "#4caf7a";
const LOSS_COLOR = "#c97565";
const TOTAL_COLOR = "#8ea3b8";

export function CicloVendasPorEtapa({ data, loading }: Props) {
  const chartData: BarChartData[] = useMemo(
    () =>
      data.map((item) => ({
        name: item.etapa,
        ciclo_medio_ganhos: item.ciclo_medio_ganhos ?? 0,
        ciclo_medio_perdas: item.ciclo_medio_perdas ?? 0,
        ciclo_medio_geral: item.ciclo_medio_geral ?? 0,
      })),
    [data],
  );

  return (
    <ChartCard
      title="Ciclo de Vendas por Etapa"
      description="Duração média (dias) por etapa — geral, ganhos e perdas. Negócio filtrado: ciclo_vendas > 0."
      loading={loading}
      height={Math.min(400, Math.max(240, data.length * 40 + 100))}
      footer={
        <div className="flex gap-4 text-[10px] font-mono">
          <span><span style={{ color: TOTAL_COLOR }}>●</span> Geral</span>
          <span><span style={{ color: GAIN_COLOR }}>●</span> Ganhos</span>
          <span><span style={{ color: LOSS_COLOR }}>●</span> Perdas</span>
        </div>
      }
    >
      <StackedBarChart
        data={chartData}
        keys={["ciclo_medio_geral", "ciclo_medio_ganhos", "ciclo_medio_perdas"]}
        height={Math.min(380, Math.max(200, data.length * 40 + 60))}
        colors={[TOTAL_COLOR, GAIN_COLOR, LOSS_COLOR]}
        seriesLabels={{
          ciclo_medio_geral: "Geral",
          ciclo_medio_ganhos: "Ganhos",
          ciclo_medio_perdas: "Perdas",
        }}
        tooltipFormatter={(v) => formatDias(v)}
        tooltipContentFormatter={(datum, value, keyLabel) => {
          const item = data.find((d) => d.etapa === datum.name);
          if (!item) return "";
          return `<div>
            <div style="font-weight:600;margin-bottom:4px">${datum.name}</div>
            <div style="color:var(--voux-tooltip-muted)">${keyLabel}: <strong style="color:var(--voux-tooltip-text)">${formatDias(value)}</strong></div>
            <div style="color:var(--voux-tooltip-muted)">Negócios: <strong style="color:var(--voux-tooltip-text)">${fmtNum(item.negocios)}</strong></div>
          </div>`;
        }}
      />
    </ChartCard>
  );
}
