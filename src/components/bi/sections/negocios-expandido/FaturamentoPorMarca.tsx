import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { FaturamentoPorMarcaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: FaturamentoPorMarcaItem[];
  loading?: boolean;
}

export function FaturamentoPorMarca({ data, loading }: Props) {
  return (
    <ChartCard
      title="Faturamento Ganho por Marca de Produto"
      description="TOP 12 marcas por valor de negócio ganho no período."
      loading={loading}
      height={Math.max(200, data.length * 34)}
    >
      <VouxBarH
        data={data.map((d) => ({ label: d.marca, value: d.valor }))}
        color="#2d7a4f"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
