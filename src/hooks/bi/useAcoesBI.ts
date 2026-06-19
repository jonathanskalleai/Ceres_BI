import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { useComercialData } from "@/hooks/useComercialData";
import type { Registro } from "@/types/comercial";

interface AcoesFilters {
  ano: string;
  mes: string;
  vendedor: string;
  tipoAcao: string;
  cidade: string;
  /** When provided, overrides ano/mes and filters by exact date range */
  dateRange?: DateRange;
}

interface AcoesKPIs {
  totalAcoes: number;
  cidades: number;
  consultores: number;
  visitas: number;
  clientes: number;
  tiposAcaoDistintos: number;
}

interface NameValue {
  name: string;
  acoes: number;
}

interface PieDatum {
  id: string;
  name: string;
  value: number;
}

export interface AcoesBIResult {
  kpis: AcoesKPIs;
  porVendedor: NameValue[];
  porCidade: NameValue[];
  porMes: NameValue[];
  porDiaSemana: NameValue[];
  porTipoAcao: PieDatum[];
  porTipoContato: PieDatum[];
  listaAnos: string[];
  isLoading: boolean;
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function getDiaSemana(dtStr: string): string {
  const d = new Date(dtStr + "T12:00:00");
  return DIAS_SEMANA[d.getDay()] || "";
}

function applyFilters(registros: Registro[], filters: AcoesFilters): Registro[] {
  let result = registros;

  // dateRange takes priority over ano/mes when provided
  if (filters.dateRange?.from) {
    const from = filters.dateRange.from.getTime();
    const to = filters.dateRange.to ? filters.dateRange.to.getTime() : from;
    result = result.filter((r) => {
      if (!r.dtConclusao) return false;
      const t = new Date(r.dtConclusao).getTime();
      return t >= from && t <= to + 86_399_999; // include full end day
    });
  } else {
    if (filters.ano) {
      result = result.filter((r) => r.dtConclusao?.startsWith(filters.ano));
    }
    if (filters.mes) {
      result = result.filter((r) => r.dtConclusao?.slice(5, 7) === filters.mes);
    }
  }

  if (filters.vendedor) {
    result = result.filter((r) => r.vendedor === filters.vendedor);
  }
  if (filters.tipoAcao) {
    result = result.filter((r) => r.tipoAcao === filters.tipoAcao);
  }
  if (filters.cidade) {
    result = result.filter((r) => r.cidade === filters.cidade);
  }
  return result;
}

function aggregate(registros: Registro[]): Omit<AcoesBIResult, "listaAnos" | "isLoading"> {
  const cidadeSet = new Set<string>();
  const consultorSet = new Set<string>();
  const clienteSet = new Set<string>();
  const tipoAcaoSet = new Set<string>();
  let visitas = 0;

  const vendedorMap = new Map<string, number>();
  const cidadeMap = new Map<string, number>();
  const mesMap = new Map<string, number>();
  const diaMap = new Map<string, number>();
  const tipoAcaoMap = new Map<string, number>();
  const tipoContatoMap = new Map<string, number>();

  for (const r of registros) {
    if (r.cidade) cidadeSet.add(r.cidade);
    if (r.vendedor) consultorSet.add(r.vendedor);
    if (r.cliente) clienteSet.add(r.cliente);
    if (r.tipoAcao) tipoAcaoSet.add(r.tipoAcao);
    if (r.tipoContato?.toLowerCase().includes("visita")) visitas++;

    if (r.vendedor) vendedorMap.set(r.vendedor, (vendedorMap.get(r.vendedor) || 0) + 1);
    if (r.cidade) cidadeMap.set(r.cidade, (cidadeMap.get(r.cidade) || 0) + 1);

    const ym = r.dtConclusao?.slice(0, 7) || "";
    if (ym) mesMap.set(ym, (mesMap.get(ym) || 0) + 1);

    if (r.dtConclusao) {
      const dia = getDiaSemana(r.dtConclusao);
      if (dia) diaMap.set(dia, (diaMap.get(dia) || 0) + 1);
    }

    if (r.tipoAcao) tipoAcaoMap.set(r.tipoAcao, (tipoAcaoMap.get(r.tipoAcao) || 0) + 1);
    if (r.tipoContato) tipoContatoMap.set(r.tipoContato, (tipoContatoMap.get(r.tipoContato) || 0) + 1);
  }

  const kpis: AcoesKPIs = {
    totalAcoes: registros.length,
    cidades: cidadeSet.size,
    consultores: consultorSet.size,
    visitas,
    clientes: clienteSet.size,
    tiposAcaoDistintos: tipoAcaoSet.size,
  };

  const porVendedor = Array.from(vendedorMap.entries())
    .map(([name, acoes]) => ({ name, acoes }))
    .sort((a, b) => b.acoes - a.acoes)
    .slice(0, 15);

  const porCidade = Array.from(cidadeMap.entries())
    .map(([name, acoes]) => ({ name, acoes }))
    .sort((a, b) => b.acoes - a.acoes)
    .slice(0, 15);

  const porMes = Array.from(mesMap.entries())
    .map(([name, acoes]) => ({ name, acoes }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const porDiaSemana = DIAS_SEMANA.slice(1).concat(DIAS_SEMANA.slice(0, 1)).map((dia) => ({
    name: dia,
    acoes: diaMap.get(dia) || 0,
  }));

  const porTipoAcao = Array.from(tipoAcaoMap.entries())
    .map(([name, value]) => ({ id: name, name, value }))
    .sort((a, b) => b.value - a.value);

  const porTipoContato = Array.from(tipoContatoMap.entries())
    .map(([name, value]) => ({ id: name, name, value }))
    .sort((a, b) => b.value - a.value);

  return { kpis, porVendedor, porCidade, porMes, porDiaSemana, porTipoAcao, porTipoContato };
}

export function useAcoesBI(active: boolean, filters: AcoesFilters, categoria?: string, funil?: string): AcoesBIResult {
  // Usa allData (sem filtro de admin users) — a tela de ações deve mostrar TODAS as ações,
  // incluindo usuários administrativos. O filtro isAdminUser é apenas para KPIs de performance.
  const { allData, isLoading } = useComercialData(categoria, funil);

  const listaAnos = useMemo(() => {
    if (!allData) return [];
    const anos = new Set<string>();
    for (const r of allData.registrosRecentes) {
      const ano = r.dtConclusao?.slice(0, 4);
      if (ano && ano.length === 4) anos.add(ano);
    }
    return Array.from(anos).sort().reverse();
  }, [allData]);

  const result = useMemo(() => {
    if (!active || !allData) {
      const empty: AcoesKPIs = { totalAcoes: 0, cidades: 0, consultores: 0, visitas: 0, clientes: 0, tiposAcaoDistintos: 0 };
      return { kpis: empty, porVendedor: [], porCidade: [], porMes: [], porDiaSemana: [], porTipoAcao: [], porTipoContato: [] };
    }
    const filtered = applyFilters(allData.registrosRecentes, filters);
    return aggregate(filtered);
  }, [active, allData, filters]);

  return { ...result, listaAnos, isLoading };
}
