import { useMemo } from "react";
import type { AcoesBIRankingItem } from "@/types/biRpc";

interface Props {
  data: AcoesBIRankingItem[];
  loading?: boolean;
}

/** Returns a Tailwind bg class based on intensity 0-1 */
function heatBg(intensity: number): string {
  if (intensity === 0) return "bg-transparent";
  if (intensity < 0.15) return "bg-blue-100/40";
  if (intensity < 0.3) return "bg-blue-100/70";
  if (intensity < 0.5) return "bg-blue-200/70";
  if (intensity < 0.7) return "bg-blue-300/70";
  if (intensity < 0.85) return "bg-blue-400/70";
  return "bg-blue-500/80";
}

function heatText(intensity: number): string {
  return intensity >= 0.7 ? "text-white" : "text-[var(--voux-text-primary)]";
}

/**
 * Heatmap Comercial: Consultor × Cidade
 * Rows = consultores (unique), Columns = cidades, Cells = qtd ações with color intensity.
 */
export function AcoesRankingTable({ data, loading }: Props) {
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

  if (loading) {
    return (
      <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
        <div className="h-4 w-48 bg-foreground/5 animate-pulse rounded mb-3" />
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 bg-foreground/5 animate-pulse rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) return null;

  return (
    <div className="rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--voux-text-muted)]">
          Heatmap Comercial · Consultor × Cidade
        </h3>
        <div className="flex items-center gap-1 text-[10px] text-[var(--voux-text-muted)]">
          <span>Baixa</span>
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-100/70" />
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-200/70" />
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-300/70" />
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-400/70" />
          <span className="inline-block w-3 h-3 rounded-sm bg-blue-500/80" />
          <span>Alta</span>
        </div>
      </div>
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
                      className={`py-2 px-2 text-center tabular-nums rounded-sm border-l border-[var(--voux-card-border)]/20 ${heatBg(intensity)} ${heatText(intensity)}`}
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
    </div>
  );
}
