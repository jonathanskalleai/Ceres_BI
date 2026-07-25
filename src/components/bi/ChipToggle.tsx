export interface ChipOption<T extends string> {
  value: T;
  label: string;
  /** Contagem opcional ao lado do rotulo (ex: "Negativas 7"). */
  count?: number;
}

interface ChipToggleProps<T extends string> {
  options: readonly ChipOption<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Rotulo do grupo para leitor de tela (obrigatorio — a11y). */
  ariaLabel: string;
  /** Prefixo textual visivel (ex: "Ordenar por:"). */
  prefix?: string;
}

/**
 * Chips de alternancia em mono uppercase — mesmo padrao dos chips de status de
 * `AcoesDetailWithFilter`, extraido porque agora ha 3 usos (regra dos 3x).
 *
 * Sao `<button aria-pressed>`, nunca `<div onClick>`: o estado precisa chegar
 * ao leitor de tela e o Tab/Enter precisa funcionar (#11 a11y).
 */
export function ChipToggle<T extends string>({ options, value, onChange, ariaLabel, prefix }: ChipToggleProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={ariaLabel}>
      {prefix && (
        <span
          className="mr-1 text-[9px] uppercase text-[var(--voux-text-muted)]"
          style={{ fontFamily: "var(--voux-font-mono)", letterSpacing: "0.22em" }}
        >
          {prefix}
        </span>
      )}
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`h-7 rounded-full border px-3 text-[10px] uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)] ${
              active
                ? "border-[var(--voux-champagne-400)] bg-[var(--voux-champagne-400)]/15 text-[var(--voux-champagne-400)]"
                : "border-[var(--voux-card-border)] bg-transparent text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            }`}
            style={{ fontFamily: "var(--voux-font-mono)", letterSpacing: "0.14em" }}
          >
            {opt.label}
            {opt.count != null && (
              <span className="ml-1.5 tabular-nums opacity-70">{opt.count.toLocaleString("pt-BR")}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
