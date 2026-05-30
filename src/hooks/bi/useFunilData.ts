import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchFunilBI, type FunilEtapaRow } from "@/services/bi/funilBIService";

interface VelocidadeDatum {
  name: string;
  diasMedio: number;
  qtd: number;
}

export interface FunilAgg {
  /** Tempo medio (dias) que negocios passam em cada etapa — gargalos do funil. */
  velocidadePorEtapa: VelocidadeDatum[];
  duracaoMediaTotal: number;
}

const num = (v: number | null): number => (typeof v === "number" && isFinite(v) ? v : 0);

export function aggregateFunil(rows: FunilEtapaRow[]): FunilAgg {
  const map = new Map<string, { soma: number; qtd: number }>();
  let somaTotal = 0;
  let qtdTotal = 0;

  for (const r of rows) {
    const dias = num(r.FNE_DuracaoDias);
    if (dias <= 0) continue;
    const etapa = (r.Etapa_dscStatusNegocio || "Sem etapa").trim() || "Sem etapa";
    const acc = map.get(etapa) ?? { soma: 0, qtd: 0 };
    acc.soma += dias;
    acc.qtd++;
    map.set(etapa, acc);
    somaTotal += dias;
    qtdTotal++;
  }

  const velocidadePorEtapa = Array.from(map.entries())
    .map(([name, { soma, qtd }]) => ({ name, diasMedio: soma / qtd, qtd }))
    .sort((a, b) => b.diasMedio - a.diasMedio)
    .slice(0, 12);

  return {
    velocidadePorEtapa,
    duracaoMediaTotal: qtdTotal > 0 ? somaTotal / qtdTotal : 0,
  };
}

export function useFunilData(enabled: boolean) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["bi-funil-etapas"],
    queryFn: fetchFunilBI,
    staleTime: 60_000,
    enabled,
  });

  const agg = useMemo(() => aggregateFunil(rows), [rows]);

  return { agg, isLoading };
}
