import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtPct } from "@/lib/formatters";
import type { ProbabilidadeVsResultadoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ProbabilidadeVsResultadoItem[];
  loading?: boolean;
}

export function ProbabilidadeVsResultado({ data, loading }: Props) {
  const sorted = [...data].sort((a, b) => a.estrelas - b.estrelas);
  return (
    <ChartCard
      title="Probabilidade CRM vs. Resultado"
      description="Taxa de conversão real por nível de estrela CRM."
      loading={loading}
      footer={
        <p className="text-[10px]" style={{ color: 'var(--voux-text-muted)', fontFamily: 'var(--voux-font-mono)' }}>
          Acima de {Math.round((sorted.find(d => d.estrelas === 3)?.taxa_conversao_real ?? 50))}% nas 3★ = calibração OK
        </p>
      }
    >
      <VouxBarH
        data={sorted.map(d => ({
          label: `${d.estrelas}★ CRM`,
          value: d.taxa_conversao_real,
          color: d.taxa_conversao_real > d.estrelas * 20 ? '#1a8c3a' : '#c0392b',
        }))}
        color="#4caf7a"
        valueFormatter={(v) => fmtPct(v)}
      />
    </ChartCard>
  );
}
