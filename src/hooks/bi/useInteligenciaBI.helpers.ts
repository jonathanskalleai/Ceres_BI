import { type DateRange } from "react-day-picker";

import { type NegocioBIRow } from "@/services/bi/negociosBIService";
import { type OrdemServicoRow } from "@/services/bi/servicosBIService";

export interface SlaBlocoResult {
  slaPorFilial: Array<{ filial: string; mediaDias: number; totalOS: number }>;
  slaPorTipoOS: Array<{ tipo: string; mediaDias: number; totalOS: number }>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Marcas proprias da concessionaria CNH Industrial */
export const NOSSAS_MARCAS = ["CASE", "CASE IH", "NEW HOLLAND", "IVECO"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function isInRange(dateStr: string | null, range: DateRange | undefined): boolean {
  if (!range?.from || !dateStr) return true; // no filter = include all
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

export function dedupNegocios(rows: NegocioBIRow[]): NegocioBIRow[] {
  const seen = new Map<string, NegocioBIRow>();
  for (const r of rows) {
    if (!seen.has(r.NGO_Numero)) seen.set(r.NGO_Numero, r);
  }
  return Array.from(seen.values());
}

export function isGanho(conclusao: string | null): boolean {
  return !!conclusao && conclusao.toLowerCase().includes("ganho");
}

export function isPerdido(conclusao: string | null): boolean {
  return !!conclusao && conclusao.toLowerCase().includes("perdi");
}

/**
 * BLOCO 4 — Pos-Venda SLA. Media de dias (encerramento - abertura) por filial e
 * por tipo de OS, considerando apenas OS encerradas dentro do dateRange.
 * Funcao pura: logica identica a inline anterior, extraida para manter o hook
 * abaixo do gate de 300 linhas.
 */
export function computeSlaBloco(
  active: boolean,
  ordensRaw: OrdemServicoRow[] | undefined,
  dateRange: DateRange | undefined,
): SlaBlocoResult {
  const empty: SlaBlocoResult = { slaPorFilial: [], slaPorTipoOS: [] };
  if (!active || !ordensRaw) return empty;

  const encerradas = ordensRaw.filter(
    (o) => o.OS_dthAbertura && o.OS_dthEncerramento && isInRange(o.OS_dthAbertura, dateRange),
  );

  const filialMap = new Map<string, { somaDias: number; count: number }>();
  const tipoMap = new Map<string, { somaDias: number; count: number }>();

  for (const o of encerradas) {
    const abertura = new Date(o.OS_dthAbertura!);
    const encerramento = new Date(o.OS_dthEncerramento!);
    if (isNaN(abertura.getTime()) || isNaN(encerramento.getTime())) continue;
    const dias = (encerramento.getTime() - abertura.getTime()) / 86_400_000;
    if (dias < 0) continue; // invalid

    const filial = o.EMP_CodFilial?.trim() || "N/A";
    if (!filialMap.has(filial)) filialMap.set(filial, { somaDias: 0, count: 0 });
    const fEntry = filialMap.get(filial)!;
    fEntry.somaDias += dias;
    fEntry.count++;

    const tipo = o.TOS_CodTipoOS?.trim() || "N/A";
    if (!tipoMap.has(tipo)) tipoMap.set(tipo, { somaDias: 0, count: 0 });
    const tEntry = tipoMap.get(tipo)!;
    tEntry.somaDias += dias;
    tEntry.count++;
  }

  const slaPorFilial = Array.from(filialMap.entries())
    .map(([filial, v]) => ({ filial, mediaDias: Math.round((v.somaDias / v.count) * 10) / 10, totalOS: v.count }))
    .sort((a, b) => b.mediaDias - a.mediaDias);

  const slaPorTipoOS = Array.from(tipoMap.entries())
    .map(([tipo, v]) => ({ tipo, mediaDias: Math.round((v.somaDias / v.count) * 10) / 10, totalOS: v.count }))
    .sort((a, b) => b.mediaDias - a.mediaDias);

  return { slaPorFilial, slaPorTipoOS };
}
