/**
 * Barra horizontal embutida em celulas de tabela — exibe proporcao visual
 * de um valor em relacao ao max da coluna. Design VOUX: champagne-400 com
 * opacidade reduzida sobre track ink-800.
 */

interface InlineBarProps {
  value: number;
  max: number;
  /** Formatador do label a direita (default: porcentagem). */
  format?: (v: number) => string;
}

export function InlineBar({ value, max, format }: InlineBarProps) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const label = format ? format(value) : `${pct.toFixed(0)}%`;

  return (
    <div className="flex items-center gap-2" role="meter" aria-valuenow={value} aria-valuemin={0} aria-valuemax={max}>
      <div className="relative h-4 flex-1 overflow-hidden rounded-sm bg-[var(--voux-ink-800)]">
        <div
          className="absolute inset-y-0 left-0 rounded-sm bg-[var(--voux-champagne-400)] transition-[width] duration-300"
          style={{ width: `${pct}%`, opacity: 0.55 }}
        />
      </div>
      <span
        className="w-12 text-right text-[10px] tabular-nums text-[var(--voux-text-muted)]"
        style={{ fontFamily: "var(--voux-font-mono)" }}
      >
        {label}
      </span>
    </div>
  );
}
