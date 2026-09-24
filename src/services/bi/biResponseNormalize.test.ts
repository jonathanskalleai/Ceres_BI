import { describe, expect, it } from "vitest";
import { arrayOrEmpty, normalizeRpcObject } from "@/services/bi/biResponseNormalize";

describe("BI response normalization", () => {
  it("keeps a complete safe shape when the backend returns null", () => {
    const defaults = { kpis: { total: 0 }, rows: [] as number[] };

    expect(normalizeRpcObject(null, defaults, ["kpis"], ["rows"])).toEqual(defaults);
  });

  it("does not let malformed nested values reach chart consumers", () => {
    const defaults = { kpis: { total: 0 }, rows: [] as number[] };
    const normalized = normalizeRpcObject(
      { kpis: { total: 4 }, rows: { invalid: true } },
      defaults,
      ["kpis"],
      ["rows"],
    );

    expect(normalized.kpis).toEqual({ total: 4 });
    expect(normalized.rows).toEqual([]);
    expect(arrayOrEmpty({ invalid: true })).toEqual([]);
  });
});
