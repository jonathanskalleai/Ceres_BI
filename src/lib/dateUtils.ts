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
