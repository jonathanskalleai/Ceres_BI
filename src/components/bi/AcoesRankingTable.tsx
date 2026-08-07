import { type CSSProperties, useMemo } from "react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import type { AcoesBIRankingItem } from "@/types/biRpc";

interface Props {
  data: AcoesBIRankingItem[];
  loading?: boolean;
  error?: Error | null;
}

/**
 * Retorna estilo inline de cor de fundo para a celula do heatmap.
 * Escala baseada na cor primaria da paleta (#8a4a14 — champagne escurecido),
 * com opacidades altas para legibilidade tanto em dark quanto em light mode.
 */
function heatStyle(intensity: number): CSSProperties {
  if (intensity === 0) return {};
  // Escala de 5 niveis: rgba do primario com opacidade crescente
  const base = "138, 74, 20"; // #8a4a14 em RGB
  if (intensity < 0.15) return { backgroundColor: `rgba(${base}, 0.15)` };
  if (intensity < 0.3) return { backgroundColor: `rgba(${base}, 0.30)` };
  if (intensity < 0.5) return { backgroundColor: `rgba(${base}, 0.50)` };
  if (intensity < 0.7) return { backgroundColor: `rgba(${base}, 0.70)` };
  if (intensity < 0.85) return { backgroundColor: `rgba(${base}, 0.85)` };
  return { backgroundColor: `rgba(${base}, 0.95)` };
}

function heatText(intensity: number): string {
  return intensity >= 0.5 ? "text-white" : "text-[var(--voux-text-primary)]";
}

/**
 * Heatmap Comercial: Consultor × Cidade
 * Rows = consultores (unique), Columns = cidades, Cells = qtd ações with color intensity.
 */
export function AcoesRankingTable({ data, loading, error }: Props) {
  const { consultores, cidades, matrix, maxValue } = useMemo(() => {
    const cidadeSet = new Set<string>();
    const consultorSet = new Set<string>();
    const map = new Map<string, number>(); // "vendedor|cidade" -> acoes

    for (const row of data) {
      cidadeSet.add(row.cidade);
      consultorSet.add(row.vendedor);
      const key = `${row.vendedor}|${row.cidade}`;
      map.set(key, (map.get(key) ?? 0) + row.acoes);
    }

    const cidades = Array.from(cidadeSet);
    const consultores = Array.from(consultorSet);
    let maxVal = 0;
    for (const v of map.values()) if (v > maxVal) maxVal = v;

    return { consultores, cidades, matrix: map, maxValue: maxVal };
  }, [data]);

  const legenda = (
    <div className="flex items-center gap-1 text-[10px] text-[var(--voux-text-muted)]">
      <span>Baixa</span>
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(138, 74, 20, 0.15)" }} />
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(138, 74, 20, 0.30)" }} />
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(138, 74, 20, 0.50)" }} />
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(138, 74, 20, 0.70)" }} />
      <span className="inline-block w-3 h-3 rounded-sm" style={{ backgroundColor: "rgba(138, 74, 20, 0.95)" }} />
      <span>Alta</span>
    </div>
  );

  return (
    <BiTableCard
      title="Heatmap Comercial · Consultor × Cidade"
      actions={legenda}
      loading={loading}
      error={error}
      isEmpty={data.length === 0}
    >
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr>
              <th className="text-left py-2 pr-3 font-medium text-[var(--voux-text-muted)] sticky left-0 bg-[var(--voux-card-from)] z-10 min-w-[140px]">
                Consultor
              </th>
              {cidades.map((c) => (
                <th
                  key={c}
                  className="py-2 px-2 font-medium text-[var(--voux-text-muted)] text-center whitespace-nowrap max-w-[100px] truncate border-l border-[var(--voux-card-border)]/20"
                  title={c}
                >
                  {c.length > 12 ? `${c.slice(0, 11)}…` : c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {consultores.map((consultor) => (
              <tr key={consultor} className="border-t border-[var(--voux-card-border)]/30">
                <td
                  className="py-2 pr-3 text-[var(--voux-text-primary)] font-medium sticky left-0 bg-[var(--voux-card-from)] z-10 truncate max-w-[140px]"
                  title={consultor}
                >
                  {consultor.length > 16 ? `${consultor.slice(0, 15)}…` : consultor}
                </td>
                {cidades.map((cidade) => {
                  const value = matrix.get(`${consultor}|${cidade}`) ?? 0;
                  const intensity = maxValue > 0 ? value / maxValue : 0;
                  return (
                    <td
                      key={cidade}
                      className={`py-2 px-2 text-center tabular-nums rounded-sm border-l border-[var(--voux-card-border)]/20 ${heatText(intensity)}`}
                      style={heatStyle(intensity)}
                      title={`${consultor} · ${cidade}: ${value.toLocaleString("pt-BR")} ações`}
                    >
                      {value > 0 ? value.toLocaleString("pt-BR") : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </BiTableCard>
  );
}
