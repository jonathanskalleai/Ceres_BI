import { type DateRange } from "react-day-picker";

/**
 * Extrai "YYYY-MM" de uma string de data ISO (ex: "2024-03-15" → "2024-03").
 * Compartilhado por hooks de agregacao para evitar duplicacao (DRY).
 */
export function yearMonth(dt: string): string {
  if (!dt) return "";
  const parts = dt.split("-");
  if (parts.length >= 2) return `${parts[0]}-${parts[1]}`;
  return "";
}

/**
 * Formata valor numerico em BRL.
 */
export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/**
 * Formata valor em BRL compacto para eixos de grafico (ex: R$ 1,8 mi, R$ 350 mil).
 * Evita poluir os ticks com numeros longos.
 */
export function formatBRLShort(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  if (abs >= 1_000) return `R$ ${(value / 1_000).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  return `R$ ${value.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}`;
}

/** Formata numero de dias de forma legivel (ex: "64 dias"). */
export function formatDias(value: number): string {
  return `${Math.round(value).toLocaleString("pt-BR")} dias`;
}

/**
 * Diferenca em dias entre duas datas ISO. Retorna null se alguma for invalida.
 * Usado para tempo de resolucao de OS, ciclo entre eventos, etc.
 */
export function daysBetween(startIso: string | null, endIso: string | null): number | null {
  if (!startIso || !endIso) return null;
  const a = Date.parse(startIso);
  const b = Date.parse(endIso);
  if (isNaN(a) || isNaN(b)) return null;
  return (b - a) / 86_400_000;
}

const MESES_ABREV = ["jan","fev","mar","abr","mai","jun","jul","ago","set","out","nov","dez"];

/** "2024-08" → "ago/2024". Retorna string original se formato inválido. */
export function formatMonthYear(ym: string): string {
  if (!ym) return "";
  const [year, month] = ym.split("-");
  const idx = parseInt(month, 10) - 1;
  if (idx < 0 || idx > 11 || !year) return ym;
  return `${MESES_ABREV[idx]}/${year}`;
}

/** "2024-03-15" → "15/03/2024". Retorna "—" se vazio. */
export function formatDateBR(d: string): string {
  if (!d) return "—";
  const parts = d.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return d;
}

/** "2026-07-31T13:54:28.977" → "31/07/2026 13:54". Retorna "—" se vazio.
 *  Aceita tambem "2026-07-31" (sem hora) → "31/07/2026".
 *  Trunca segundos e milissegundos para manter coluna compacta. */
export function formatDateTimeBR(d: string): string {
  if (!d) return "—";
  const datePart = d.slice(0, 10); // YYYY-MM-DD
  const timeMatch = d.match(/T(\d{2}):(\d{2})/);
  const dateStr = formatDateBR(datePart);
  return timeMatch ? `${dateStr} ${timeMatch[1]}:${timeMatch[2]}` : dateStr;
}

/** Converte Date → "YYYY-MM-DD" no fuso local (sem deslocamento UTC). */
export function toISODate(d: Date | undefined): string | undefined {
  if (!d) return undefined;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Deriva o periodo anterior ("mesmo periodo, 1 ano atras") a partir de um DateRange.
 * Usado para analise comparativa nos KPICards. Retorna undefined se nao houver `from`.
 */
export function getPreviousPeriod(dateRange: DateRange | undefined): DateRange | undefined {
  if (!dateRange?.from) return undefined;
  const from = new Date(dateRange.from);
  from.setFullYear(from.getFullYear() - 1);
  const to = dateRange.to ? new Date(dateRange.to) : new Date(dateRange.from);
  to.setFullYear(to.getFullYear() - 1);
  return { from, to };
}

export type Trend = "up" | "down" | "neutral";

/** Compara valor atual vs anterior e retorna a direcao da tendencia. */
export function calcTrend(atual: number, anterior: number): Trend {
  if (atual > anterior) return "up";
  if (atual < anterior) return "down";
  return "neutral";
}
