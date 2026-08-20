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
  1: "0–30d",
  2: "31–60d",
  3: "61–90d",
  4: "91–180d",
  5: "180d+",
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

  // Dynamic sizing: use label width of 52px (compact labels), rest divided among etapas
  const labelW = 52;
  const availableW = containerWidth > 0 ? containerWidth - labelW : 400;
  const gap = 3;
  const cellW = Math.max(Math.min(60, Math.floor((availableW - (etapas.length - 1) * gap) / Math.max(etapas.length, 1))), 32);
  const cellH = 44;

  return (
    <ChartCard
      title="Etapa × Idade do Negócio"
      description="Valor em carteira por etapa e faixa de idade. Mais escuro = maior valor."
      loading={loading}
      height={FAIXAS_ORDEM.length * (cellH + gap) + 40}
    >
      <div ref={containerRef} style={{ width: '100%', overflow: 'hidden' }}>
        {containerWidth > 0 && (
          <div style={{ width: "100%" }}>
            {/* Header: etapa labels */}
            <div style={{ display: "flex", gap, marginBottom: gap }}>
              <div style={{ width: labelW, flexShrink: 0 }} />
              {etapas.map((etapa) => (
                <div
                  key={etapa}
                  style={{ width: cellW, flexShrink: 0, textAlign: "center" }}
                >
                  <span
                    className="block truncate text-[9px] font-medium"
                    style={{ color: "var(--voux-text-muted)" }}
                    title={etapa}
                  >
                    {etapa}
                  </span>
                </div>
              ))}
            </div>

            {/* Data rows */}
            {FAIXAS_ORDEM.map((ordem) => (
              <div key={ordem} style={{ display: "flex", gap, marginBottom: gap, alignItems: "center" }}>
                <div style={{ width: labelW, flexShrink: 0 }}>
                  <span className="text-[9px] font-medium" style={{ color: "var(--voux-text-muted)" }}>
                    {FAIXA_LABELS[ordem]}
                  </span>
                </div>
                {etapas.map((etapa) => {
                  const item = rows.get(etapa)?.get(ordem);
                  const color = item ? getColor(item.valor, maxValor) : "var(--voux-card-border)";
                  const label = item ? fmtBRLKpi(item.valor) : "";

                  return (
                    <div
                      key={`${etapa}-${ordem}`}
                      style={{
                        width: cellW,
                        height: cellH,
                        flexShrink: 0,
                        background: color,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      title={item ? `${etapa} | ${FAIXA_LABELS[ordem]}\n${fmtBRLKpi(item.valor)} | ${item.negocios} neg.` : ""}
                    >
                      {item && item.valor > 0 && (
                        <span
                          className="text-[8px] font-semibold tabular-nums leading-none"
                          style={{ color: item.valor > maxValor * 0.4 ? "#fff" : "var(--voux-text-primary)" }}
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
