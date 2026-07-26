import { describe, it, expect } from "vitest";
import {
  safeRatio,
  funilRatios,
  sortRanking,
  faixaToDiasRange,
  fmtRatio,
  fmtPctOrDash,
  fmtDiasSemContato,
  fmtDiasParado,
  RANKING_CRITERIOS,
} from "../acoesGestaoUtils";
import type { AcoesFunil, AcoesRankingConsultorItem } from "@/types/biRpc";

const ranking: AcoesRankingConsultorItem[] = [
  { consultor: "CONSULTOR C", visitas: 381, oportunidades: 150, ganhos: 4, valorGanho: 900_000, taxaConversao: 2.7 },
  { consultor: "CONSULTOR D", visitas: 615, oportunidades: 80, ganhos: 0, valorGanho: 0, taxaConversao: 0 },
  { consultor: "CONSULTOR B", visitas: 461, oportunidades: 190, ganhos: 0, valorGanho: 0, taxaConversao: 0 },
  { consultor: "CONSULTOR A", visitas: 100, oportunidades: 10, ganhos: 4, valorGanho: 2_500_000, taxaConversao: 40 },
];

describe("safeRatio — divisao por zero", () => {
  it("should return null when denominator is zero", () => {
    expect(safeRatio(3679, 0)).toBeNull();
  });

  it("should return null when either side is null or undefined", () => {
    expect(safeRatio(null, 10)).toBeNull();
    expect(safeRatio(10, null)).toBeNull();
    expect(safeRatio(undefined, undefined)).toBeNull();
  });

  it("should never return Infinity or NaN", () => {
    for (const v of [safeRatio(1, 0), safeRatio(0, 0), safeRatio(Number.NaN, 5), safeRatio(5, Number.NaN)]) {
      expect(v).toBeNull();
    }
  });

  it("should round to 2 decimals when the ratio is valid", () => {
    expect(safeRatio(3679, 662)).toBe(5.56);
    expect(safeRatio(662, 48)).toBe(13.79);
  });

  it("should return 0 when numerator is zero and denominator is not (zero IS a measurement)", () => {
    expect(safeRatio(0, 48)).toBe(0);
  });
});

describe("funilRatios", () => {
  const base: AcoesFunil = {
    visitas: 3679,
    oportunidades: 662,
    ganhos: 48,
    visitasPorOportunidade: 5.56,
    oportPorFechamento: 13.77,
  };

  it("should keep the values the RPC already computed", () => {
    expect(funilRatios(base)).toEqual({ visitasPorOportunidade: 5.56, oportPorFechamento: 13.77 });
  });

  it("should recompute when the RPC omitted the field (partial payload)", () => {
    const r = funilRatios({ ...base, visitasPorOportunidade: null, oportPorFechamento: null });
    expect(r.visitasPorOportunidade).toBe(5.56);
    expect(r.oportPorFechamento).toBe(13.79);
  });

  it("should return null for BOTH ratios when there are no oportunidades nor ganhos", () => {
    const r = funilRatios({
      visitas: 120, oportunidades: 0, ganhos: 0,
      visitasPorOportunidade: null, oportPorFechamento: null,
    });
    expect(r.visitasPorOportunidade).toBeNull();
    expect(r.oportPorFechamento).toBeNull();
  });

  it("should return null only for oportPorFechamento when ganhos is zero", () => {
    const r = funilRatios({
      visitas: 3679, oportunidades: 662, ganhos: 0,
      visitasPorOportunidade: null, oportPorFechamento: null,
    });
    expect(r.visitasPorOportunidade).toBe(5.56);
    expect(r.oportPorFechamento).toBeNull();
  });

  it("should return null for every ratio on a fully empty funil (no division by zero leak)", () => {
    const r = funilRatios({
      visitas: 0, oportunidades: 0, ganhos: 0,
      visitasPorOportunidade: null, oportPorFechamento: null,
    });
    expect(r).toEqual({ visitasPorOportunidade: null, oportPorFechamento: null });
  });
});

describe("sortRanking — os 4 criterios", () => {
  it("should sort by visitas desc", () => {
    expect(sortRanking(ranking, "visitas").map((r) => r.consultor)).toEqual([
      "CONSULTOR D", "CONSULTOR B", "CONSULTOR C", "CONSULTOR A",
    ]);
  });

  it("should sort by oportunidades desc", () => {
    expect(sortRanking(ranking, "oportunidades").map((r) => r.consultor)).toEqual([
      "CONSULTOR B", "CONSULTOR C", "CONSULTOR D", "CONSULTOR A",
    ]);
  });

  it("should sort by ganhos desc, breaking ties by consultor name (stable order)", () => {
    // CONSULTOR C e CONSULTOR A empatam em 4 ganhos: desempate alfabetico e obrigatorio,
    // senao a lista troca de ordem entre renders.
    expect(sortRanking(ranking, "ganhos").map((r) => r.consultor)).toEqual([
      "CONSULTOR A", "CONSULTOR C", "CONSULTOR B", "CONSULTOR D",
    ]);
  });

  it("should sort by valorGanho desc — different podium than fechamentos", () => {
    expect(sortRanking(ranking, "valorGanho").map((r) => r.consultor)).toEqual([
      "CONSULTOR A", "CONSULTOR C", "CONSULTOR B", "CONSULTOR D",
    ]);
  });

  it("should apply topN without mutating the input array", () => {
    const before = ranking.map((r) => r.consultor);
    const top2 = sortRanking(ranking, "visitas", 2);
    expect(top2).toHaveLength(2);
    expect(ranking.map((r) => r.consultor)).toEqual(before);
  });

  it("should return an empty array for empty input on every criterio", () => {
    for (const c of RANKING_CRITERIOS) expect(sortRanking([], c)).toEqual([]);
  });
});

describe("faixaToDiasRange — drill-down do chart de risco", () => {
  it("should map closed ranges", () => {
    expect(faixaToDiasRange("0-15")).toEqual({ diasMin: 0, diasMax: 15 });
    expect(faixaToDiasRange("31-60")).toEqual({ diasMin: 31, diasMax: 60 });
  });

  it("should leave the +90 band open on the right so the 999 sentinel falls into it", () => {
    expect(faixaToDiasRange("+90")).toEqual({ diasMin: 91 });
  });

  it("should return null for an unknown label instead of guessing a range", () => {
    expect(faixaToDiasRange("ontem")).toBeNull();
    expect(faixaToDiasRange("")).toBeNull();
  });
});

describe("formatadores", () => {
  it("should render a dash instead of 0/NaN when there is no ratio", () => {
    expect(fmtRatio(null)).toBe("—");
    expect(fmtRatio(Number.NaN)).toBe("—");
    expect(fmtPctOrDash(null)).toBe("—");
  });

  it("should never render '999 dias' — it is a sentinel, not a measurement", () => {
    expect(fmtDiasSemContato(999)).toBe("Sem acao no ano");
    expect(fmtDiasSemContato(999, true)).toBe("Sem acao no ano");
    expect(fmtDiasSemContato(42, false)).toBe("42 dias");
  });

  it("should never render 'null dias' for a deal without any action", () => {
    expect(fmtDiasParado(null)).toBe("Sem acao registrada");
    expect(fmtDiasParado(undefined)).toBe("Sem acao registrada");
    expect(fmtDiasParado(81)).toBe("81 dias");
  });
});
