import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { ValorPorCidadeItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: ValorPorCidadeItem[];
  loading?: boolean;
}


export function ValorPorCidade({ data, loading }: Props) {
  const filtered = data.filter(d => d.valor_ganho > 0).slice(0, 10);
  return (
    <ChartCard
      title="Valor Ganho por Cidade"
      description="TOP 10 cidades por valor ganho."
      loading={loading}
    >
      <VouxBarH
        data={filtered.map((d) => ({ label: `${d.cidade} (${d.uf})`, value: d.valor_ganho }))}
        color="#4caf7a"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
