import { useMemo } from "react";
import ComboChart from "@/components/bi/charts/ComboChart";
import { formatMonthYear } from "@/lib/dateUtils";
import type { RpcEvolucaoGPO } from "@/hooks/useEvolucaoGPO";

/** Short month label: "2026-07" → "jul/26" */
const fmtShort = (ym: string) => formatMonthYear(ym).replace(/\/20(\d{2})$/, "/$1");

interface EvolucaoGPOChartProps {
  data: RpcEvolucaoGPO[];
  height?: number;
  loading?: boolean;
}

const BAR_COLORS = ["#4caf7a", "#e57373"] as const; // green (vendas), coral (perdas)
const LINE_COLOR = "#f59e0b"; // amber (oportunidades)

const LEGEND_ITEMS = [
  { color: BAR_COLORS[0], label: "Vendas" },
  { color: BAR_COLORS[1], label: "Perdas" },
  { color: LINE_COLOR, label: "Oportunidades" },
] as const;

export default function EvolucaoGPOChart({ data, height = 300, loading = false }: EvolucaoGPOChartProps) {
  const chartData = useMemo(
    () =>
      data.map((d) => ({
        name: fmtShort(d.mes),
        vendas: Number(d.ganhos),
        perdas: Number(d.perdidos),
        oportunidades: Number(d.oportunidades),
      })),
    [data],
  );

  return (
    <div className="w-full">
      {/* Legenda fixa visível */}
      <div className="flex items-center gap-5 mb-2 px-1">
        {LEGEND_ITEMS.map((item) => (
          <div key={item.label} className="flex items-center gap-1.5">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ background: item.color }}
            />
            <span
              className="text-[12px] font-medium"
              style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-muted)" }}
            >
              {item.label}
            </span>
          </div>
        ))}
      </div>
      <ComboChart
        data={chartData}
        barKeys={["vendas", "perdas"]}
        lineKey="oportunidades"
        seriesLabels={{ vendas: "Vendas", perdas: "Perdas", oportunidades: "Oportunidades" }}
        barColors={BAR_COLORS}
        lineColor={LINE_COLOR}
        height={height}
        loading={loading}
        showDataLabels
        tooltipFormatter={(v, _key) => v.toLocaleString("pt-BR")}
      />
    </div>
  );
}
