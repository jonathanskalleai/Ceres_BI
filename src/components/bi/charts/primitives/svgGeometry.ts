/**
 * VOUX SVG Chart — pure geometry helpers (no React).
 */

// ── Color tokens (CSS-var based for light/dark theming) ──────────────────────
export const VOUX_COLORS = {
  accent:     "var(--voux-accent)",
  ink:        "var(--voux-text-primary)",
  inkSoft:    "var(--voux-text-muted)",
  inkMuted:   "var(--voux-text-muted)",
  inkFaint:   "var(--voux-text-faint)",
  grid:       "var(--voux-grid-line)",
  gridStrong: "var(--voux-grid-line)",
  track:      "var(--voux-grid-line)",
  surface:    "var(--voux-surface)",
  // Semantic status colors (unchanged)
  success:  "#7a9b6f",
  warning:  "#d4a05a",
  danger:   "#c97565",
  info:     "#8ea3b8",
} as const;

// Dark palette (existing — warm muted on dark bg)
export const VOUX_PALETTE = [
  "#c8b99a", "#7ca88e", "#c27c5a", "#8b9dc3", "#b8a9d4", "#6e542f", "#8a8273",
] as const;

// Light palette — tons terrosos sóbrios (referência: coral → âmbar → sage → verde)
export const VOUX_PALETTE_LIGHT = [
  "#4caf7a", "#d4a05a", "#c97565", "#8ea3b8", "#7a9b6f", "#6e542f", "#d4b896",
] as const;

/** Returns the correct chart palette based on active theme. */
export function getVouxPalette(isDark: boolean): readonly string[] {
  return isDark ? VOUX_PALETTE : VOUX_PALETTE_LIGHT;
}

// ── Tick generation ───────────────────────────────────────────────────────────
/**
 * Returns nicely rounded tick values between [min, max].
 * Rounds step to nearest "nice" power-of-10 multiple so labels like
 * 89_061 become 100_000, giving clean axis annotations.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const rawStep = (max - min) / count;
  // Round step up to nearest "nice" power-of-10 multiple
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  const niceMults = [1, 2, 2.5, 5, 10];
  const niceStep =
    magnitude * (niceMults.find((m) => m * magnitude >= rawStep) ?? 10);
  // Align min to step boundary
  const niceMin = Math.floor(min / niceStep) * niceStep;
  const niceMax = Math.ceil(max / niceStep) * niceStep;
  const ticks: number[] = [];
  for (let t = niceMin; t <= niceMax + niceStep * 0.001; t += niceStep) {
    ticks.push(Math.round(t * 1e9) / 1e9); // avoid float drift
  }
  return ticks;
}

// ── Number formatter ─────────────────────────────────────────────────────────
/**
 * Compact numeric formatter (pt-BR style).
 * 1200 → "1.2k", 1_500_000 → "1.5M"
 */
export function fmtCompact(n: number | null | undefined): string {
  if (n == null) return "";
  const abs = Math.abs(n);
  if (abs >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + "M";
  if (abs >= 1e3) return (n / 1e3).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

// ── Unique gradient ID ────────────────────────────────────────────────────────
let _gradCounter = 0;
export function gradId(prefix = "g"): string {
  return `${prefix}-${++_gradCounter}`;
}
