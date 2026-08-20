import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtPct } from "@/lib/formatters";
import type { TaxaPerdaPorBancoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: TaxaPerdaPorBancoItem[];
  loading?: boolean;
}

export function TaxaPerdaPorBanco({ data, loading }: Props) {
  return (
    <ChartCard
      title="Taxa de Perda por Banco Financiador"
      description="Bancos com maior taxa de perda (ordenados do maior para o menor)."
      loading={loading}
    >
      <VouxBarH
        data={data.map((d) => ({ label: d.banco, value: d.taxa_perda }))}
        color="#c97565"
        valueFormatter={(v) => fmtPct(v)}
      />
    </ChartCard>
  );
}
