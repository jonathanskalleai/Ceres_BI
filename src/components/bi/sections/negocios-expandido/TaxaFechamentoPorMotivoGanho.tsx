import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { TaxaFechamentoPorMotivoGanhoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: TaxaFechamentoPorMotivoGanhoItem[];
  loading?: boolean;
}

export function TaxaFechamentoPorMotivoGanho({ data, loading }: Props) {
  return (
    <ChartCard
      title="Taxa de Fechamento por Motivo de Ganho"
      description="Motivos mais frequentes com maior valor ganho. Barra = valor; tooltip = taxa de conversão."
      loading={loading}
    >
      <VouxBarH
        data={data.map((d) => ({ label: d.motivo, value: d.valor_ganho }))}
        color="#bf8a2e"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
