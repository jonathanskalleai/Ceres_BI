/**
 * VOUX SVG Chart — pure geometry helpers (no React).
 */

// ── Color tokens ──────────────────────────────────────────────────────────────
export const VOUX_COLORS = {
  accent:   "#d4b896",
  accent2:  "#b8945a",
  accent3:  "#6e542f",
  ink:      "#ece5d4",
  inkSoft:  "#b3ab9c",
  inkMuted: "#8a8273",
  inkFaint: "#6b6253",
  grid:     "rgba(214,207,193,0.06)",
  gridStrong: "rgba(214,207,193,0.10)",
  track:    "rgba(214,207,193,0.04)",
  surface:  "#18160f",
  success:  "#7a9b6f",
  warning:  "#d4a05a",
  danger:   "#c97565",
  info:     "#8ea3b8",
} as const;

export const VOUX_PALETTE = [
  VOUX_COLORS.accent,
  VOUX_COLORS.info,
  VOUX_COLORS.success,
  VOUX_COLORS.warning,
  VOUX_COLORS.danger,
  VOUX_COLORS.accent3,
  VOUX_COLORS.inkMuted,
] as const;

// ── Tick generation ───────────────────────────────────────────────────────────
/**
 * Returns `count+1` evenly spaced tick values between [min, max].
 * Always includes 0 when min <= 0 <= max.
 */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max === min) max = min + 1;
  const step = (max - min) / count;
  return Array.from({ length: count + 1 }, (_, i) => min + i * step);
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
