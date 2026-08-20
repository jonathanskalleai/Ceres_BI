import { ChartCard } from "@/components/bi/ChartCard";
import { VouxDonut } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { FaturamentoPorMarcaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: FaturamentoPorMarcaItem[];
  loading?: boolean;
}

const PALETTE = ['#e06060', '#5ba3d9', '#1a8c3a', '#d4a05a', '#8ea3b8', '#4caf7a', '#c97565', '#7a9b6f'];

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
