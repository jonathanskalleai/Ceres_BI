import { Filters, Registro } from "@/types/comercial";

export function filterRegistros(records: Registro[], filters: Filters): Registro[] {
  let result = records;
  if (filters.dateRange?.from) {
    result = result.filter((r) => r.dtConclusao && r.dtConclusao >= filters.dateRange!.from);
  }
  if (filters.dateRange?.to) {
    result = result.filter((r) => r.dtConclusao && r.dtConclusao <= filters.dateRange!.to);
  }
  if (filters.cidade) result = result.filter((r) => r.cidade === filters.cidade);
  if (filters.tipoAcao) result = result.filter((r) => r.tipoAcao === filters.tipoAcao);
  return result;
}

export function filterEvolucao(evolucao: { YearMonth: string }[], filters: Filters) {
  let result = evolucao;
  if (filters.dateRange?.from) {
    const fromYM = filters.dateRange.from.slice(0, 7); // YYYY-MM
    result = result.filter((e) => e.YearMonth >= fromYM);
  }
  if (filters.dateRange?.to) {
    const toYM = filters.dateRange.to.slice(0, 7);
    result = result.filter((e) => e.YearMonth <= toYM);
  }
  return result;
}

export const hasActiveFilters = (filters: Filters) =>
  !!(filters.dateRange || filters.cidade || filters.tipoAcao || filters.categoria || filters.funil);
