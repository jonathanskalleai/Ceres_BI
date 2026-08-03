import type { LucideIcon } from "lucide-react";

const MONO = "var(--voux-font-mono)";

/** Largura relativa do degrau. Piso de 18% para o ultimo estagio nao sumir. */
function larguraPct(valor: number, base: number): number {
  if (base <= 0) return 18;
  return Math.max(18, Math.round((valor / base) * 100));
}

interface AcoesDegrauBarProps {
  icon: LucideIcon;
  label: string;
  valor: number;
  base: number;
  /** Aplica cor solida (usado em Ganho/Perdido). Ausente = gradient champagne (Visitas/Oportunidades). */
  accent?: "success" | "danger";
  /** Tooltip hint. */
  hint: string;
}

/**
 * Barra larga horizontal com icone + numero + label + tooltip.
 * Extraido de `AcoesFunilConversao` para ser reutilizado em Visitas, Oportunidades,
 * Ganho e Perdido — mantendo os 3 componentes sob seus limites de linha.
 *
 * - `accent` ausente → gradient champagne (Visitas/Oportunidades)
 * - `accent='success'` → cor solida success
 * - `accent='danger'` → cor solida danger
 */
export function AcoesDegrauBar({ icon: Icon, label, valor, base, accent, hint }: AcoesDegrauBarProps) {
  const largura = larguraPct(valor, base);
  const bgStyle =
    accent === "success"
      ? "var(--voux-success)"
      : accent === "danger"
        ? "var(--voux-danger)"
        : "linear-gradient(90deg, var(--voux-accent) 0%, var(--voux-champagne-400) 100%)";

  return (
    <div className="flex items-center gap-3" title={hint}>
      <div
        className="relative flex h-14 items-center rounded-xl px-4 transition-[width] duration-500"
        style={{
          width: `${largura}%`,
          minWidth: 150,
          background: bgStyle,
          opacity: 0.92,
        }}
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--surface-raised)]" aria-hidden="true" />
        <span
          className="ml-2 text-lg font-semibold tabular-nums text-[var(--surface-raised)]"
          style={{ fontFamily: "var(--voux-font-display)" }}
        >
          {valor.toLocaleString("pt-BR")}
        </span>
        <span
          className="ml-2 truncate text-[10px] uppercase text-[var(--surface-raised)]"
          style={{ fontFamily: MONO, letterSpacing: "0.22em", opacity: 0.85 }}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
