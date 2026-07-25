import { VOUX_COLORS } from "./primitives/svgGeometry";

// ── Tooltip ────────────────────────────────────────────────────────────────────
export interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  content: string;
}

export const INITIAL_TOOLTIP: TooltipState = {
  visible: false,
  x: 0,
  y: 0,
  content: "",
};

export function BarChartTooltip({ state }: { state: TooltipState }) {
  if (!state.visible) return null;
  return (
    <div
      style={{
        position: "fixed",
        left: state.x + 14,
        top: state.y - 10,
        background: "var(--voux-tooltip-bg)",
        border: "1px solid var(--voux-tooltip-border)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        padding: "8px 12px",
        borderRadius: 10,
        fontFamily: "var(--voux-font-mono)",
        fontSize: 11,
        color: "var(--voux-tooltip-text)",
        pointerEvents: "none",
        zIndex: 9999,
        whiteSpace: "nowrap",
      }}
      dangerouslySetInnerHTML={{ __html: state.content }}
    />
  );
}

// ── Color resolver ────────────────────────────────────────────────────────────
export function resolveColor(
  keyIndex: number,
  dataIndex: number,
  colors: readonly string[],
  itemColors?: string[],
): string {
  if (itemColors) return itemColors[dataIndex % itemColors.length];
  return colors[keyIndex % colors.length];
}

// ── Tooltip content builder ───────────────────────────────────────────────────
export function buildTooltipContent(
  keyLabel: string,
  label: string,
  formatted: string,
): string {
  return `<div style="font-size:10px;color:var(--voux-tooltip-muted);margin-bottom:3px;text-transform:uppercase;letter-spacing:0.1em">${keyLabel}</div><div style="font-size:13px;color:var(--voux-tooltip-text)"><strong>${label}</strong>: ${formatted}</div>`;
}

/**
 * Escapa texto vindo do banco antes de virar HTML do tooltip.
 *
 * Mora aqui, junto do `buildTooltipContent`, porque o `BarChartTooltip`
 * renderiza via `dangerouslySetInnerHTML`: quem monta conteudo de tooltip
 * precisa do escape ao alcance, e duas copias divergentes da funcao de escape
 * e exatamente como um dos lados fica para tras.
 */
export function escapeTooltipText(value: string): string {
  return value.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] ?? c,
  );
}

/** Linha "rotulo ......... valor" de um tooltip multi-metrica. */
export function tooltipRow(label: string, valor: string): string {
  return `<div style="display:flex;justify-content:space-between;gap:14px"><span style="color:var(--voux-tooltip-muted)">${label}</span><span>${valor}</span></div>`;
}

/** Cabecalho (nome da entidade) de um tooltip multi-metrica. Ja escapa o nome. */
export function tooltipTitle(nome: string): string {
  return `<div style="font-size:12px;margin-bottom:5px"><strong>${escapeTooltipText(nome)}</strong></div>`;
}

// ── Series legend label ───────────────────────────────────────────────────────
export function SeriesLabel({
  color,
  label,
}: {
  color: string;
  label: string;
}) {
  return (
    <div
      style={{
        fontFamily: "var(--voux-font-mono)",
        fontSize: 10,
        color: VOUX_COLORS.inkMuted,
        letterSpacing: "0.10em",
        marginBottom: 4,
        display: "flex",
        alignItems: "center",
        gap: 6,
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: color,
        }}
      />
      {label}
    </div>
  );
}
