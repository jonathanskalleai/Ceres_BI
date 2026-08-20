/**
 * fmtCompact — replica exata de charts.js fmtCompact
 * ≥1e6 → toFixed(1) sem ".0" + "M"
 * ≥1e3 → toFixed(1) sem ".0" + "k"  (1 casa decimal, diferente do formatCompact em shared.tsx)
 * <1e3 → string do número
 */
export function fmtCompact(n: number): string {
  const abs = Math.abs(n)
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return String(n)
}

/** "R$ " + fmtCompact(n) */
export function fmtBRLCompact(n: number): string {
  return 'R$ ' + fmtCompact(n)
}
