import { describe, it, expect } from "vitest";
import {
  getCategoria,
  getFunisByCategoria,
  getAllMappedFunis,
  getFunilOptions,
  resolveFunis,
  CATEGORIA_ALL,
  FUNIL_ALL,
  ALL_FUNIS,
  CATEGORIA_OPTIONS,
} from "../categoriaFunil";

describe("getCategoria", () => {
  it("should return 'Vendas Maquinas' for funis in that category", () => {
    expect(getCategoria("VENDAS")).toBe("Vendas Maquinas");
    expect(getCategoria("ADM")).toBe("Vendas Maquinas");
    expect(getCategoria("BANCOS")).toBe("Vendas Maquinas");
    expect(getCategoria("OFICINA")).toBe("Vendas Maquinas");
    expect(getCategoria("MARKETING")).toBe("Vendas Maquinas");
  });

  it("should return 'Vendas AP' for funis in that category", () => {
    expect(getCategoria("Vendas AP")).toBe("Vendas AP");
    expect(getCategoria("Adm AP")).toBe("Vendas AP");
    expect(getCategoria("Logistica AP")).toBe("Vendas AP");
  });

  it("should return 'Repasse' for REPASSE DE MAQUINA", () => {
    expect(getCategoria("REPASSE DE MAQUINA")).toBe("Repasse");
  });

  it("should return undefined for unmapped funil names", () => {
    expect(getCategoria("INEXISTENTE")).toBeUndefined();
    expect(getCategoria("")).toBeUndefined();
    expect(getCategoria("vendas")).toBeUndefined(); // case-sensitive
  });
});

describe("getFunisByCategoria", () => {
  it("should return correct funis for Vendas Maquinas", () => {
    const funis = getFunisByCategoria("Vendas Maquinas");
    expect(funis).toEqual(["VENDAS", "ADM", "BANCOS", "OFICINA", "MARKETING"]);
  });

  it("should return correct funis for Vendas AP", () => {
    const funis = getFunisByCategoria("Vendas AP");
    expect(funis).toEqual(["Vendas AP", "Adm AP", "Logistica AP"]);
  });

  it("should return correct funis for Repasse", () => {
    const funis = getFunisByCategoria("Repasse");
    expect(funis).toEqual(["REPASSE DE MAQUINA"]);
  });

  it("should return empty array for CATEGORIA_ALL", () => {
    expect(getFunisByCategoria(CATEGORIA_ALL)).toEqual([]);
  });
});

describe("getAllMappedFunis", () => {
  it("should return all 9 funis from all categories", () => {
    const all = getAllMappedFunis();
    expect(all).toHaveLength(9);
    expect(all).toContain("VENDAS");
    expect(all).toContain("Vendas AP");
    expect(all).toContain("REPASSE DE MAQUINA");
  });

  it("should match the ALL_FUNIS constant", () => {
    expect(getAllMappedFunis()).toEqual(ALL_FUNIS);
  });
});

describe("getFunilOptions", () => {
  it("should include 'Todos os funis' as first option when CATEGORIA_ALL", () => {
    const options = getFunilOptions(CATEGORIA_ALL);
    expect(options[0]).toEqual({ value: FUNIL_ALL, label: "Todos os funis" });
    // All 9 individual funis + 1 "todos"
    expect(options).toHaveLength(10);
  });

  it("should return category-specific funis + todos header for a specific category", () => {
    const options = getFunilOptions("Vendas AP");
    expect(options[0]).toEqual({ value: FUNIL_ALL, label: "Todos os funis" });
    expect(options).toHaveLength(4); // todos + 3 funis AP
  });
});

describe("resolveFunis", () => {
  it("should return single funil array when funil is specified and not __all__", () => {
    expect(resolveFunis("Vendas Maquinas", "VENDAS")).toEqual(["VENDAS"]);
  });

  it("should return category funis when funil is __all__ but category is set", () => {
    expect(resolveFunis("Vendas AP", FUNIL_ALL)).toEqual(["Vendas AP", "Adm AP", "Logistica AP"]);
  });

  it("should return undefined when both are __all__ (no filter)", () => {
    expect(resolveFunis(CATEGORIA_ALL, FUNIL_ALL)).toBeUndefined();
  });

  it("should return undefined when neither is provided", () => {
    expect(resolveFunis(undefined, undefined)).toBeUndefined();
  });

  it("should return undefined when categoria is __all__ and funil is undefined", () => {
    expect(resolveFunis(CATEGORIA_ALL, undefined)).toBeUndefined();
  });
});

describe("CATEGORIA_OPTIONS", () => {
  it("should have 4 options (Todos + 3 categories)", () => {
    expect(CATEGORIA_OPTIONS).toHaveLength(4);
    expect(CATEGORIA_OPTIONS[0].value).toBe(CATEGORIA_ALL);
  });
});
