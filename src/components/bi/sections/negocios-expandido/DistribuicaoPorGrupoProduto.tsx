import { ChartCard } from "@/components/bi/ChartCard";
import { VouxDonut } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { DistribuicaoPorGrupoProdutoItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: DistribuicaoPorGrupoProdutoItem[];
  loading?: boolean;
}

const PALETTE = ['#e06060', '#5ba3d9', '#1a8c3a', '#d4a05a', '#8ea3b8', '#4caf7a', '#c97565', '#7a9b6f'];

export function DistribuicaoPorGrupoProduto({ data, loading }: Props) {
  const total = data.reduce((s, d) => s + d.valor_ganho, 0);
  return (
    <ChartCard
      title="Distribuição por Grupo de Produto"
      description="Participação de cada grupo no valor total ganho."
      loading={loading}
    >
      <VouxDonut
        data={data.map((d, i) => ({ label: d.grupo, value: d.valor_ganho, color: PALETTE[i % PALETTE.length] }))}
        height={240}
        thickness={24}
        centerLabel="Total"
        centerValue={fmtBRLKpi(total)}
      />
    </ChartCard>
  );
}
