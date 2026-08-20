import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { formatDias } from "@/lib/dateUtils";
import type { CicloVendasPorEtapaItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: CicloVendasPorEtapaItem[];
  loading?: boolean;
}

export function CicloVendasPorEtapa({ data, loading }: Props) {
  return (
    <ChartCard
      title="Ciclo de Vendas por Etapa"
      description="Duração média (dias) em cada etapa do funil."
      loading={loading}
      footer={
        <div className="flex gap-4 text-[10px]" style={{ fontFamily: 'var(--voux-font-mono)' }}>
          <span><span style={{ color: '#8ea3b8' }}>●</span> Geral</span>
          <span><span style={{ color: '#4caf7a' }}>●</span> Ganhos</span>
          <span><span style={{ color: '#c97565' }}>●</span> Perdas</span>
        </div>
      }
    >
      <VouxBarH
        data={data.map((d, i) => ({ label: d.etapa, value: d.ciclo_medio_geral ?? 0, color: ['#e06060','#c97565','#d4a05a','#5ba3d9','#1a8c3a','#4caf7a','#7a9b6f','#8ea3b8'][i % 8] }))}
        color="#8ea3b8"
        valueFormatter={(v) => formatDias(v)}
      />
    </ChartCard>
  );
}
