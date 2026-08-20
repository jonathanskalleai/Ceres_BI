import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { VouxLine } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import { formatMonthYear } from "@/lib/dateUtils";
import type { UsadoRecebidoPorMesItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: UsadoRecebidoPorMesItem[];
  loading?: boolean;
}

export function UsadoRecebidoPorMes({ data, loading }: Props) {
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
      <div className="space-y-4">
        <VouxLine
          data={data.map((d) => ({ label: formatMonthYear(d.name), value: d.valor_usado_total }))}
          color="#d4a05a"
          fmt={fmtBRLKpi}
          height={240}
          area
        />
        <VouxLine
          data={data.map((d) => ({ label: formatMonthYear(d.name), value: d.valor_usado_ganho }))}
          color="#4caf7a"
          fmt={fmtBRLKpi}
          height={200}
          area
        />
      </div>
    </ChartCard>
  );
}
