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
