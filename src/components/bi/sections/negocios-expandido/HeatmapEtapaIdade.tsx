import { useMemo, useRef } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { fmtBRLKpi } from "@/lib/formatters";
import { useContainerWidth } from "@/components/bi/charts/primitives/useContainerWidth";
import type { HeatmapEtapaIdadeItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: HeatmapEtapaIdadeItem[];
  loading?: boolean;
}

const HEATMAP_SCALE = [
  "#f8edc3", "#f2dba8", "#ebc98e", "#e0b574",
  "#d4a05a", "#bf8a2e", "#a67322", "#8c5e1a",
  "#734b14", "#5a3a0e",
];

const FAIXAS_ORDEM = [1, 2, 3, 4, 5];
const FAIXA_LABELS: Record<number, string> = {
  1: "0-30 dias",
  2: "31-60 dias",
  3: "61-90 dias",
  4: "91-180 dias",
  5: "180+ dias",
};

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "var(--voux-card-border)";
  const ratio = Math.log1p(value) / Math.log1p(max);
  const idx = Math.min(Math.floor(ratio * HEATMAP_SCALE.length), HEATMAP_SCALE.length - 1);
  return HEATMAP_SCALE[idx];
}

export function HeatmapEtapaIdade({ data, loading }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef as React.RefObject<HTMLElement>);

  const { etapas, rows, maxValor } = useMemo(() => {
    const etapaSet = new Set<string>();
    const map = new Map<string, Map<number, HeatmapEtapaIdadeItem>>();
    let max = 0;

    for (const item of data) {
      etapaSet.add(item.etapa);
      if (!map.has(item.etapa)) map.set(item.etapa, new Map());
      const inner = map.get(item.etapa)!;
      inner.set(item.ordem_faixa, item);
      if (item.valor > max) max = item.valor;
    }

    return {
      etapas: Array.from(etapaSet).sort(),
      rows: map,
      maxValor: max,
    };
  }, [data]);

  if (!etapas.length) return null;

  const labelW = 140;
  const cellSize = Math.max(Math.min(72, (containerWidth - labelW) / Math.max(etapas.length, 1) - 4), 40);
  const colW = cellSize + 4;

  return (
    <ChartCard
      title="Matriz: Etapa do Funil x Idade do Negócio"
      description="Valor dos negócios em carteira por etapa e faixa de idade (snapshot atual). Células mais escuras = maior valor."
      loading={loading}
      height={Math.min(400, Math.max(220, FAIXAS_ORDEM.length * cellSize + 80))}
    >
      <div ref={containerRef} style={{ width: "100%", minWidth: 0 }}>
        {containerWidth > 0 && (
          <div style={{ width: "100%", position: "relative", minWidth: 0 }}>
            {/* Header row: etapa labels */}
            <div className="flex">
              <div style={{ width: labelW, flexShrink: 0 }} />
              {etapas.map((etapa) => (
                <div
                  key={etapa}
                  style={{ width: colW }}
                  className="px-1 pb-1 text-center"
                >
                  <span
                    className="block truncate text-[10px] font-medium"
                    style={{ color: "var(--voux-text-muted)", maxWidth: cellSize }}
                    title={etapa}
                  >
                    {etapa}
                  </span>
                </div>
              ))}
            </div>

            {/* Data rows */}
            {FAIXAS_ORDEM.map((ordem) => (
              <div key={ordem} className="flex items-center">
                <div style={{ width: labelW, flexShrink: 0 }} className="pr-2">
                  <span className="text-[10px]" style={{ color: "var(--voux-text-muted)" }}>
                    {FAIXA_LABELS[ordem]}
                  </span>
                </div>
                {etapas.map((etapa) => {
                  const item = rows.get(etapa)?.get(ordem);
                  const color = item ? getColor(item.valor, maxValor) : "var(--voux-card-border)";
                  const label = item ? fmtBRLKpi(item.valor) : "—";

                  return (
                    <div
                      key={`${etapa}-${ordem}`}
                      style={{
                        width: cellSize,
                        height: cellSize - 4,
                        background: color,
                        borderRadius: 6,
                        marginRight: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        cursor: item ? "default" : "default",
                      }}
                      title={item ? `${etapa} | ${FAIXA_LABELS[ordem]}\n${fmtBRLKpi(item.valor)} | ${item.negocios} negócios` : ""}
                    >
                      {item && item.valor > 0 && (
                        <span
                          className="text-[9px] font-semibold tabular-nums"
                          style={{ color: item.valor > maxValor * 0.5 ? "#fff" : "var(--voux-text-primary)" }}
                        >
                          {label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </ChartCard>
  );
}
