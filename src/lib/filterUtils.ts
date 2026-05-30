import { Filters, Registro } from "@/types/comercial";

export function filterRegistros(records: Registro[], filters: Filters): Registro[] {
  let result = records;
  if (filters.vendedor) result = result.filter((r) => r.vendedor === filters.vendedor);
  if (filters.cidade) result = result.filter((r) => r.cidade === filters.cidade);
  if (filters.tipoAcao) result = result.filter((r) => r.tipoAcao === filters.tipoAcao);
  if (filters.ano) result = result.filter((r) => r.dtConclusao?.includes(filters.ano));
  if (filters.mes) {
    result = result.filter((r) => {
      const parts = r.dtConclusao?.split(/[-/]/);
      return parts && parts.length >= 2 && parts[1] === filters.mes;
    });
  }
  return result;
}

export function filterEvolucao(evolucao: { YearMonth: string }[], filters: Filters) {
  let result = evolucao;
  if (filters.ano) result = result.filter((e) => e.YearMonth?.startsWith(filters.ano));
  if (filters.mes) result = result.filter((e) => e.YearMonth?.endsWith(`-${filters.mes}`));
  return result;
}

export const hasActiveFilters = (filters: Filters) => Object.values(filters).some(Boolean);
