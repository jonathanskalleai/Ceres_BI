import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { ValorPorCidadeItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ValorPorCidadeItem[];
  loading?: boolean;
}

export function ValorPorCidade({ data, loading }: Props) {
  return (
    <ChartCard
      title="Valor Ganho por Cidade"
      description="TOP 30 cidades por valor de negócio ganho no período."
      loading={loading}
    >
      <VouxBarH
        data={data.map((d) => ({ label: `${d.cidade} (${d.uf})`, value: d.valor_ganho }))}
        color="#5ba3d9"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
