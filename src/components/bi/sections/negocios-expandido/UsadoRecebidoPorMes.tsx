import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { VouxDualLine } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import { formatMonthYear } from "@/lib/dateUtils";
import type { UsadoRecebidoPorMesItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: UsadoRecebidoPorMesItem[];
  loading?: boolean;
}

export function UsadoRecebidoPorMes({ data, loading }: Props) {
  const total = useMemo(() => data.reduce((s, d) => s + d.valor_usado_total, 0), [data]);
  const totalGanho = useMemo(() => data.reduce((s, d) => s + d.valor_usado_ganho, 0), [data]);

  return (
    <ChartCard
      title="Usado/Troca Recebido por Mês"
      description="Tracking mensal de valor de usado total vs. em negócios ganhos."
      loading={loading}
      footer={
        <div className="flex gap-6 text-[11px]" style={{ fontFamily: 'var(--voux-font-mono)' }}>
          <span><span style={{ color: '#c49000' }}>●</span> Total: <strong>{fmtBRLKpi(total)}</strong></span>
          <span><span style={{ color: '#1a8c3a' }}>●</span> Em ganhos: <strong>{fmtBRLKpi(totalGanho)}</strong></span>
        </div>
      }
    >
      <VouxDualLine
        data={data.map(d => ({ label: formatMonthYear(d.name), serieA: d.valor_usado_total, serieB: d.valor_usado_ganho }))}
        height={380}
        labelA="Usado total"
        labelB="Usado em ganhos"
        colorA="#c49000"
        colorB="#1a8c3a"
        fmtA={fmtBRLKpi}
        fmtB={fmtBRLKpi}
      />
    </ChartCard>
  );
}
