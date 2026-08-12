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
 * Chips de alternancia em mono uppercase, com 3 usos nos blocos de gestao
 * comercial (ranking, esforco x retorno, abas da carteira).
 *
 * Segue a APARENCIA dos chips de status de `AcoesDetailWithFilter`, mas aquele
 * NAO foi migrado para ca: ele pinta cada opcao com uma cor semantica propria
 * (`colorClass` por status — champagne/verde/terracota), coisa que este
 * componente nao faz. Migrar exigiria dar `colorClass` ao ChipToggle e mexer
 * num bloco que ja funciona e esta coberto pelo `## Smoke` da feature — custo e
 * risco sem ganho para o usuario. Se um terceiro caso precisar de cor por
 * opcao, ai sim vale unificar.
 *
 * Sao `<button aria-pressed>`, nunca `<div onClick>`: o estado precisa chegar
 * ao leitor de tela e o Tab/Enter precisa funcionar (#11 a11y).
 */
export function ChipToggle<T extends string>({ options, value, onChange, ariaLabel, prefix }: ChipToggleProps<T>) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={ariaLabel}>
      {prefix && (
        <span
          className="mr-1 text-[10px] font-medium uppercase text-[var(--voux-text-muted)]"
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
            className={`h-8 rounded-lg border px-3.5 text-[11px] font-medium uppercase shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)] ${
              active
                ? "border-[var(--voux-champagne-400)] bg-[var(--voux-champagne-400)]/20 text-[var(--voux-text-primary)]"
                : "border-[var(--voux-card-border)] bg-[var(--surface-raised)] text-[var(--voux-text-muted)] hover:border-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
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
