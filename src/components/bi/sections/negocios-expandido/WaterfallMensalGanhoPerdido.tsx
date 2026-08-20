import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import { formatMonthYear } from "@/lib/dateUtils";
import { useMemo } from "react";
import type { WaterfallMensalGanhoPerdidoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: WaterfallMensalGanhoPerdidoItem[];
  loading?: boolean;
}

export function WaterfallMensalGanhoPerdido({ data, loading }: Props) {
  const summary = useMemo(() => ({
    totalGanho: data.reduce((s, d) => s + d.ganho, 0),
    totalPerda: data.reduce((s, d) => s + d.perda, 0),
    totalLiquido: data.reduce((s, d) => s + d.liquido, 0),
  }), [data]);

  const ganhoData = data.filter(d => d.ganho > 0).map(d => ({
    label: formatMonthYear(d.name),
    value: d.ganho,
  }));

  const perdaData = data.filter(d => d.perda > 0).map(d => ({
    label: formatMonthYear(d.name),
    value: d.perda,
  }));

  return (
    <ChartCard
      title="Evolução Mensal: Ganho vs. Perda"
      description="Valores ganhos e perdidos por mês no período."
      loading={loading}
      footer={
        <div className="flex gap-6 text-[11px]" style={{ fontFamily: 'var(--voux-font-mono)' }}>
          <span><span style={{ color: '#4caf7a' }}>●</span> Ganho: <strong>{fmtBRLKpi(summary.totalGanho)}</strong></span>
          <span><span style={{ color: '#c97565' }}>●</span> Perda: <strong>{fmtBRLKpi(summary.totalPerda)}</strong></span>
          <span><span style={{ color: summary.totalLiquido >= 0 ? '#4caf7a' : '#c97565' }}>●</span> Líquido: <strong>{fmtBRLKpi(summary.totalLiquido)}</strong></span>
        </div>
      }
    >
      <div className="space-y-6">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--voux-text-muted)', fontFamily: 'var(--voux-font-mono)' }}>Ganhos por mês</p>
          <VouxBarH data={ganhoData} color="#4caf7a" valueFormatter={fmtBRLKpi} />
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] mb-2" style={{ color: 'var(--voux-text-muted)', fontFamily: 'var(--voux-font-mono)' }}>Perdas por mês</p>
          <VouxBarH data={perdaData} color="#c97565" valueFormatter={fmtBRLKpi} />
        </div>
      </div>
    </ChartCard>
  );
}
