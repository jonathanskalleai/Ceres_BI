import { beforeEach, describe, expect, it } from "vitest";
import { arrayOrEmpty, normalizeRpcObject } from "@/services/bi/biResponseNormalize";
import { biQuality } from "@/lib/bi/biQualityStore";

beforeEach(() => biQuality.clearAll());

describe("BI response normalization", () => {
  it("fails closed when the backend returns null instead of inventing zeros", () => {
    const defaults = { kpis: { total: 0 }, rows: [] as number[] };

    expect(() => normalizeRpcObject(null, defaults, ["kpis"], ["rows"])).toThrow("Resposta vazia");
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
    expect(biQuality.getSnapshot()[0]).toMatchObject({
      source: "bi.rpc",
      status: "partial",
    });
  });
});
