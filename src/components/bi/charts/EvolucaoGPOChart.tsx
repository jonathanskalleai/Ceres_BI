import { useMemo } from "react";
import ComboChart from "@/components/bi/charts/ComboChart";
import { formatMonthYear, formatBRLShort } from "@/lib/dateUtils";
import type { RpcEvolucaoGPO } from "@/hooks/useEvolucaoGPO";

/** Short month label: "2026-07" → "jul/26" */
const fmtShort = (ym: string) => formatMonthYear(ym).replace(/\/20(\d{2})$/, "/$1");

interface EvolucaoGPOChartProps {
  data: RpcEvolucaoGPO[];
  height?: number;
  loading?: boolean;
}

const BAR_COLORS = ["#4caf7a", "#e57373"] as const; // green (ganhos), coral (perdidos)
const LINE_COLOR = "#f59e0b"; // amber (oportunidades)

export default function EvolucaoGPOChart({ data, height = 300, loading = false }: EvolucaoGPOChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: fmtShort(d.mes),
        ganhos: Number(d.ganhos),
        perdidos: Number(d.perdidos),
        oportunidades: Number(d.oportunidades),
      })),
    [data],
  );

  return (
    <ComboChart
      data={chartData}
      barKeys={["ganhos", "perdidos"]}
      lineKey="oportunidades"
      seriesLabels={{ ganhos: "Ganhos", perdidos: "Perdidos", oportunidades: "Oportunidades" }}
      barColors={BAR_COLORS}
      lineColor={LINE_COLOR}
      height={height}
      loading={loading}
      tooltipFormatter={(v, _key) => v.toLocaleString("pt-BR")}
    />
  );
}
