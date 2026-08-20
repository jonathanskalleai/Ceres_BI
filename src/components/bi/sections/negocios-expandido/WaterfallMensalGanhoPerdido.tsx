import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { VouxDualLine } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import { formatMonthYear } from "@/lib/dateUtils";
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

  return (
    <ChartCard
      title="Evolução Mensal: Ganho vs. Perda"
      description="Comparação mensal dos valores ganhos e perdidos."
      loading={loading}
      footer={
        <div className="flex gap-6 text-[11px]" style={{ fontFamily: 'var(--voux-font-mono)' }}>
          <span><span style={{ color: '#1a8c3a' }}>●</span> Ganho: <strong>{fmtBRLKpi(summary.totalGanho)}</strong></span>
          <span><span style={{ color: '#c0392b' }}>●</span> Perda: <strong>{fmtBRLKpi(summary.totalPerda)}</strong></span>
          <span style={{ color: summary.totalLiquido >= 0 ? '#1a8c3a' : '#c0392b' }}>Líquido: <strong>{fmtBRLKpi(summary.totalLiquido)}</strong></span>
        </div>
      }
    >
      <VouxDualLine
        data={data.map(d => ({ label: formatMonthYear(d.name), serieA: d.ganho, serieB: d.perda }))}
        height={320}
        labelA="Ganho"
        labelB="Perda"
        colorA="#1a8c3a"
        colorB="#c0392b"
        fmtA={fmtBRLKpi}
        fmtB={fmtBRLKpi}
      />
    </ChartCard>
  );
}
