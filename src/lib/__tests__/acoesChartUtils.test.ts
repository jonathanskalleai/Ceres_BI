import { describe, it, expect } from "vitest";
import { buildTipoAcaoBars, TIPO_ACAO_TOP_N } from "../acoesChartUtils";
import type { AcoesBIPieDatum } from "@/types/biRpc";

/** 17 tipos somando 622 — shape real do mes atual medido no banco vivo. */
function makeTipos(n: number, total: number): AcoesBIPieDatum[] {
  const base = Math.floor(total / n);
  const rest = total - base * n;
  return Array.from({ length: n }, (_, i) => ({
    name: `Tipo ${i + 1}`,
    value: base + (i === 0 ? rest : 0),
  }));
}

describe("buildTipoAcaoBars", () => {
  it("should return Top 8 + 1 linha Outros when there are more than 8 tipos", () => {
    const bars = buildTipoAcaoBars(makeTipos(17, 622));
    expect(bars).toHaveLength(TIPO_ACAO_TOP_N + 1);
    expect(bars[bars.length - 1].name).toBe("Outros (9 tipos)");
  });

  it("should preserve the total volume when aggregating Outros", () => {
    const data = makeTipos(17, 622);
    const bars = buildTipoAcaoBars(data);
    expect(bars.reduce((a, b) => a + b.acoes, 0)).toBe(622);
  });

  it("should sort descending so the biggest tipo is the first bar", () => {
    const bars = buildTipoAcaoBars([
      { name: "Pequeno", value: 3 },
      { name: "Grande", value: 90 },
      { name: "Medio", value: 20 },
    ]);
    expect(bars.map((b) => b.name)).toEqual(["Grande", "Medio", "Pequeno"]);
  });

  it("should not add an Outros row when tipos fit within the Top N", () => {
    const bars = buildTipoAcaoBars(makeTipos(TIPO_ACAO_TOP_N, 100));
    expect(bars).toHaveLength(TIPO_ACAO_TOP_N);
    expect(bars.some((b) => b.name.startsWith("Outros"))).toBe(false);
  });

  it("should handle an empty payload without throwing", () => {
    expect(buildTipoAcaoBars([])).toEqual([]);
  });

  it("should not mutate the input array", () => {
    const data: AcoesBIPieDatum[] = [
      { name: "A", value: 1 },
      { name: "B", value: 9 },
    ];
    buildTipoAcaoBars(data);
    expect(data.map((d) => d.name)).toEqual(["A", "B"]);
  });
});
