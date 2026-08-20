import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { VouxBarH } from "@/components/charts/voux";
import { fmtBRLKpi } from "@/lib/formatters";
import type { HeatmapEtapaIdadeItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: HeatmapEtapaIdadeItem[];
  loading?: boolean;
}

const FAIXA_LABELS: Record<number, string> = {
  1: "0–30d", 2: "31–60d", 3: "61–90d", 4: "91–180d", 5: "180d+",
};

export function HeatmapEtapaIdade({ data, loading }: Props) {
  // Show top 12 cells by value
  const top = useMemo(() => 
    [...data].filter(d => d.valor > 0).sort((a, b) => b.valor - a.valor).slice(0, 12),
    [data]
  );

  return (
    <ChartCard
      title="Carteira por Etapa × Idade"
      description="Maiores concentrações de valor na carteira ativa."
      loading={loading}
    >
      <VouxBarH
        data={top.map(d => ({
          label: `${d.etapa} · ${FAIXA_LABELS[d.ordem_faixa] ?? d.ordem_faixa}`,
          value: d.valor,
        }))}
        color="#8c6d3f"
        valueFormatter={fmtBRLKpi}
      />
    </ChartCard>
  );
}
