import { describe, expect, it } from "vitest";
import { biFiltersKey, hasBiFilter, normalizeBiFilters } from "@/lib/bi/biFilterContract";

describe("BI filter contract", () => {
  it("normalizes blank values and sorts funnel arrays", () => {
    expect(normalizeBiFilters({ vendedor: "  ", funis: ["Parcerias", "Vendas", "Parcerias"] })).toMatchObject({
      vendedor: null,
      funis: ["Parcerias", "Vendas"],
    });
  });

  it("creates the same key for equivalent filter selections", () => {
    expect(biFiltersKey({ funis: ["B", "A"] })).toBe(biFiltersKey({ funis: ["A", "B", "A"] }));
  });

  it("does not report an active filter for empty controls", () => {
    expect(hasBiFilter({ vendedor: "", funis: [] })).toBe(false);
    expect(hasBiFilter({ cidade: "Curitiba" })).toBe(true);
  });
});
