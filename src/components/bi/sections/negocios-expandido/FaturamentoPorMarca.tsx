import { ChartCard } from "@/components/bi/ChartCard";
import { VouxDonut } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { FaturamentoPorMarcaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: FaturamentoPorMarcaItem[];
  loading?: boolean;
}

const PALETTE = ['#1a8c3a', '#c49000', '#2970b3', '#c0392b', '#8c6d3f', '#7a9b6f', '#8ea3b8', '#d4b896'];

export function FaturamentoPorMarca({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.valor, 0);
  return (
    <ChartCard
      title="Faturamento por Marca"
      description="Participação por marca no valor ganho."
      loading={loading}
    >
      <VouxDonut
        data={data.map((d, i) => ({ label: d.marca, value: d.valor, color: PALETTE[i % PALETTE.length] }))}
        height={220}
        thickness={22}
        centerLabel="Total"
        centerValue={fmtBRLKpi(total)}
      />
    </ChartCard>
  );
}
