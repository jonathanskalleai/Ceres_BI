/** Format currency in R$ pt-BR style */
export function fmtBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/** Format percentage */
export function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

/** Format integer with thousands separator */
export function fmtNum(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(Math.round(value));
}

/** Format days */
export function fmtDias(value: number): string {
  return `${Math.round(value)} dias`;
}

/** Check if a numeric KPI value is zero/empty (should hide the card) */
export function isEmpty(v: number): boolean {
  return v === 0 || isNaN(v);
}
