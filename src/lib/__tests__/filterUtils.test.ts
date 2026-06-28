import { describe, it, expect } from "vitest";
import { filterRegistros, filterEvolucao, hasActiveFilters } from "../filterUtils";
import type { Filters, Registro } from "@/types/comercial";

const makeRegistro = (overrides: Partial<Registro> = {}): Registro => ({
  cliente: "Cliente A",
  cidade: "Uberlandia",
  vendedor: "Carlos",
  tipoContato: "Telefone",
  tipoAcao: "Visita",
  negocioValor: 10000,
  negocioEtapa: "Proposta",
  dtConclusao: "2024-06-15",
  obs: "",
  ...overrides,
});

const emptyFilters: Filters = {
  cidade: "",
  tipoAcao: "",
  categoria: "",
  funil: "",
};

describe("filterRegistros", () => {
  const records: Registro[] = [
    makeRegistro({ dtConclusao: "2024-01-10", cidade: "SP", tipoAcao: "Visita" }),
    makeRegistro({ dtConclusao: "2024-03-20", cidade: "RJ", tipoAcao: "Ligacao" }),
    makeRegistro({ dtConclusao: "2024-06-05", cidade: "SP", tipoAcao: "Visita" }),
    makeRegistro({ dtConclusao: "2024-09-01", cidade: "BH", tipoAcao: "Email" }),
  ];

  it("should return all records when no filters are set", () => {
    const result = filterRegistros(records, emptyFilters);
    expect(result).toHaveLength(4);
  });

  it("should filter by dateRange.from", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "2024-03-01", to: "" } };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(3);
    expect(result.every((r) => r.dtConclusao >= "2024-03-01")).toBe(true);
  });

  it("should filter by dateRange.to", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "", to: "2024-06-30" } };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(3);
  });

  it("should filter by dateRange from+to combined", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "2024-03-01", to: "2024-06-30" } };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(2);
  });

  it("should filter by cidade", () => {
    const filters: Filters = { ...emptyFilters, cidade: "SP" };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(2);
    expect(result.every((r) => r.cidade === "SP")).toBe(true);
  });

  it("should filter by tipoAcao", () => {
    const filters: Filters = { ...emptyFilters, tipoAcao: "Visita" };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(2);
  });

  it("should combine multiple filters (AND logic)", () => {
    const filters: Filters = { ...emptyFilters, cidade: "SP", tipoAcao: "Visita" };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(2);
  });

  it("should return empty array when no records match", () => {
    const filters: Filters = { ...emptyFilters, cidade: "Manaus" };
    const result = filterRegistros(records, filters);
    expect(result).toHaveLength(0);
  });

  it("should handle empty input array", () => {
    const filters: Filters = { ...emptyFilters, cidade: "SP" };
    const result = filterRegistros([], filters);
    expect(result).toHaveLength(0);
  });
});

describe("filterEvolucao", () => {
  const evolucao = [
    { YearMonth: "2024-01", acoes: 10, visitas: 5 },
    { YearMonth: "2024-03", acoes: 20, visitas: 8 },
    { YearMonth: "2024-06", acoes: 15, visitas: 6 },
    { YearMonth: "2024-09", acoes: 25, visitas: 12 },
  ];

  it("should return all entries when no dateRange filter", () => {
    const result = filterEvolucao(evolucao, emptyFilters);
    expect(result).toHaveLength(4);
  });

  it("should filter by from (YearMonth >= from's YYYY-MM)", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "2024-03-01", to: "" } };
    const result = filterEvolucao(evolucao, filters);
    expect(result).toHaveLength(3);
    expect(result[0].YearMonth).toBe("2024-03");
  });

  it("should filter by to (YearMonth <= to's YYYY-MM)", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "", to: "2024-06-30" } };
    const result = filterEvolucao(evolucao, filters);
    expect(result).toHaveLength(3);
  });

  it("should handle empty evolucao array", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "2024-01-01", to: "2024-12-31" } };
    const result = filterEvolucao([], filters);
    expect(result).toHaveLength(0);
  });
});

describe("hasActiveFilters", () => {
  it("should return false when no filters are set", () => {
    expect(hasActiveFilters(emptyFilters)).toBe(false);
  });

  it("should return true when dateRange is set", () => {
    const filters: Filters = { ...emptyFilters, dateRange: { from: "2024-01-01", to: "2024-12-31" } };
    expect(hasActiveFilters(filters)).toBe(true);
  });

  it("should return true when cidade is set", () => {
    expect(hasActiveFilters({ ...emptyFilters, cidade: "SP" })).toBe(true);
  });

  it("should return true when tipoAcao is set", () => {
    expect(hasActiveFilters({ ...emptyFilters, tipoAcao: "Visita" })).toBe(true);
  });

  it("should return true when categoria is set", () => {
    expect(hasActiveFilters({ ...emptyFilters, categoria: "Vendas Maquinas" })).toBe(true);
  });

  it("should return true when funil is set", () => {
    expect(hasActiveFilters({ ...emptyFilters, funil: "VENDAS" })).toBe(true);
  });
});
