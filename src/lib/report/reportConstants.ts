export const COLORS = {
  primary: [30, 64, 175] as [number, number, number],
  success: [22, 163, 74] as [number, number, number],
  warning: [202, 138, 4] as [number, number, number],
  danger: [220, 38, 38] as [number, number, number],
  dark: [30, 41, 59] as [number, number, number],
  muted: [100, 116, 139] as [number, number, number],
  bg: [248, 250, 252] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  lightBg: [241, 245, 249] as [number, number, number],
};

export function formatCurrency(v: number): string {
  if (v >= 1e6) return `R$ ${(v / 1e6).toFixed(2)}M`;
  if (v >= 1e3) return `R$ ${(v / 1e3).toFixed(0)}K`;
  return `R$ ${v.toFixed(0)}`;
}

export function formatDate(d: string): string {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
}
