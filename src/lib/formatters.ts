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

/**
 * Smart KPI currency formatter — abbreviates large values to avoid overflow.
 * >= 10 mi  → "R$ 12,3 mi"  (1 decimal, no forced)
 * >= 1 mi   → "R$ 3,2 mi"   (1 decimal, always shown)
 * < 1 mi    → "R$ 845.200"  (full locale format)
 */
export function fmtBRLKpi(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 10_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (abs >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} mi`;
  }
  return fmtBRL(value);
}

/** Check if a numeric KPI value is zero/empty (should hide the card) */
export function isEmpty(v: number): boolean {
  return v === 0 || isNaN(v);
}
