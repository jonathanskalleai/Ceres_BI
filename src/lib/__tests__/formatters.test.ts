import { describe, it, expect } from "vitest";
import { fmtBRL, fmtPct, fmtNum, fmtDias, fmtBRLKpi, isEmpty } from "../formatters";

describe("fmtBRL", () => {
  it("should format positive integer as R$ with thousands separator", () => {
    expect(fmtBRL(1500)).toBe("R$ 1.500");
  });

  it("should format zero as R$ 0", () => {
    expect(fmtBRL(0)).toBe("R$ 0");
  });

  it("should format negative value with minus sign", () => {
    const result = fmtBRL(-2500);
    expect(result).toContain("2.500");
    expect(result).toMatch(/-/);
  });

  it("should round decimals (no fraction digits)", () => {
    expect(fmtBRL(1234.56)).toBe("R$ 1.235");
  });

  it("should handle very large values", () => {
    const result = fmtBRL(15000000);
    expect(result).toContain("15.000.000");
  });
});

describe("fmtPct", () => {
  it("should format percentage with 1 decimal place", () => {
    expect(fmtPct(75.5)).toBe("75.5%");
  });

  it("should format zero", () => {
    expect(fmtPct(0)).toBe("0.0%");
  });

  it("should format negative percentage", () => {
    expect(fmtPct(-12.34)).toBe("-12.3%");
  });

  it("should round to 1 decimal place", () => {
    expect(fmtPct(33.3333)).toBe("33.3%");
  });

  it("should handle 100%", () => {
    expect(fmtPct(100)).toBe("100.0%");
  });
});

describe("fmtNum", () => {
  it("should format integer with pt-BR thousands separator", () => {
    expect(fmtNum(12500)).toBe("12.500");
  });

  it("should format zero", () => {
    expect(fmtNum(0)).toBe("0");
  });

  it("should round decimals before formatting", () => {
    expect(fmtNum(1234.7)).toBe("1.235");
  });

  it("should handle large numbers", () => {
    expect(fmtNum(1000000)).toBe("1.000.000");
  });
});

describe("fmtDias", () => {
  it("should format days", () => {
    expect(fmtDias(30)).toBe("30 dias");
  });

  it("should round decimals", () => {
    expect(fmtDias(7.6)).toBe("8 dias");
  });

  it("should handle zero", () => {
    expect(fmtDias(0)).toBe("0 dias");
  });
});

describe("fmtBRLKpi", () => {
  it("should abbreviate values >= 10 million with 'mi'", () => {
    const result = fmtBRLKpi(12300000);
    expect(result).toContain("12,3");
    expect(result).toContain("mi");
    expect(result).toContain("R$");
  });

  it("should abbreviate values >= 1 million with 'mi' (1 decimal)", () => {
    const result = fmtBRLKpi(3200000);
    expect(result).toContain("3,2");
    expect(result).toContain("mi");
  });

  it("should use full format for values < 1 million", () => {
    const result = fmtBRLKpi(845200);
    expect(result).toContain("845.200");
    expect(result).not.toContain("mi");
  });

  it("should handle zero", () => {
    expect(fmtBRLKpi(0)).toBe("R$ 0");
  });

  it("should handle negative large values", () => {
    const result = fmtBRLKpi(-15000000);
    expect(result).toContain("mi");
    expect(result).toMatch(/-/);
  });
});

describe("isEmpty", () => {
  it("should return true for 0", () => {
    expect(isEmpty(0)).toBe(true);
  });

  it("should return true for NaN", () => {
    expect(isEmpty(NaN)).toBe(true);
  });

  it("should return false for positive number", () => {
    expect(isEmpty(42)).toBe(false);
  });

  it("should return false for negative number", () => {
    expect(isEmpty(-1)).toBe(false);
  });
});
