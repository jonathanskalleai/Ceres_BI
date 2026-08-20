import { useMemo } from "react";
import { ChartCard } from "@/components/bi/ChartCard";
import { fmtBRLKpi } from "@/lib/formatters";
import type { HeatmapEtapaIdadeItem } from "@/types/bi/negociosExpandido";

interface Props {
  data: HeatmapEtapaIdadeItem[];
  loading?: boolean;
}

const SEQUENTIAL_BLUE = [
  "#cde2fb", "#b7d3f6", "#9ec5f4", "#86b6ef",
  "#6da7ec", "#5598e7", "#3987e5", "#2a78d6",
  "#256abf", "#1c5cab",
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
  if (max === 0 || value === 0) return "#f0efed";
  const ratio = Math.log1p(value) / Math.log1p(max);
  const idx = Math.min(Math.floor(ratio * SEQUENTIAL_BLUE.length), SEQUENTIAL_BLUE.length - 1);
  return SEQUENTIAL_BLUE[idx];
}

export function HeatmapEtapaIdade({ data, loading }: Props) {
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

  const cellSize = 72;
  const labelW = 140;
  const colW = cellSize + 4;
  const chartW = labelW + etapas.length * colW;

  return (
    <ChartCard
      title="Matriz: Etapa do Funil x Idade do Negócio"
      description="Valor dos negócios em carteira por etapa e faixa de idade (snapshot atual). Células mais escuras = maior valor."
      loading={loading}
      height={Math.min(400, Math.max(220, FAIXAS_ORDEM.length * cellSize + 80))}
    >
      <div className="overflow-x-auto">
        <div style={{ width: chartW, position: "relative" }}>
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
                const color = item ? getColor(item.valor, maxValor) : "#f0efed";
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
      </div>
    </ChartCard>
  );
}
