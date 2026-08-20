import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { LineChart, type LineChartSeriesItem } from "@/components/bi/charts";
import { fmtBRLKpi } from "@/lib/formatters";
import { formatMonthYear } from "@/lib/dateUtils";
import type { UsadoRecebidoPorMesItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: UsadoRecebidoPorMesItem[];
  loading?: boolean;
}

export function UsadoRecebidoPorMes({ data, loading }: Props) {
  const series: LineChartSeriesItem[] = useMemo(() => {
    const months = data.map((d) => formatMonthYear(d.name));

    return [
      {
        name: "Valor Usado Total",
        color: "#d4a05a",
        data: data.map((d) => ({ x: formatMonthYear(d.name), y: d.valor_usado_total })),
      },
      {
        name: "Valor Usado em Ganhos",
        color: "#4caf7a",
        data: data.map((d) => ({ x: formatMonthYear(d.name), y: d.valor_usado_ganho })),
      },
    ];
  }, [data]);

  const total = useMemo(
    () => data.reduce((s, d) => s + d.valor_usado_total, 0),
    [data],
  );

  const negociosComUsado = useMemo(
    () => data.reduce((s, d) => s + d.negocios_com_usado, 0),
    [data],
  );

  return (
    <ChartCard
      title="Valor de Usado/Troca Recebido por Mês"
      description="Tracking mensal do valor de usado recebido. Rolling 12 meses."
      loading={loading}
      height={300}
      footer={
        <div className="flex gap-6 text-[11px] font-mono">
          <span>
            <span style={{ color: "#d4a05a" }}>●</span> Total:{" "}
            <strong style={{ color: "var(--voux-text-primary)" }}>{fmtBRLKpi(total)}</strong>
          </span>
          <span>
            <span style={{ color: "#4caf7a" }}>●</span> Em Ganhos:{" "}
            <strong style={{ color: "var(--voux-text-primary)" }}>{fmtBRLKpi(data.reduce((s, d) => s + d.valor_usado_ganho, 0))}</strong>
          </span>
          <span style={{ color: "var(--voux-text-muted)" }}>
            {negociosComUsado} negócios com usado
          </span>
        </div>
      }
    >
      <LineChart
        series={series}
        height={240}
        area
        showValues={false}
        tooltipFormatter={(v) => fmtBRLKpi(v)}
      />
    </ChartCard>
  );
}
