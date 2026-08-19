import { type ElementType, useState } from "react";
import { CircleHelp, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ElementType;
  hint?: string;
  /** Formula/explanation shown on hover */
  formula?: string;
  loading?: boolean;
  accentColor?: string;
  /** Formatted previous period value to display */
  previousValue?: string | number;
  /** Trend direction */
  trend?: "up" | "down" | "neutral";
  /** When true, a downward trend is positive (e.g. fewer losses) */
  invertTrend?: boolean;
  dataSource?: string;
  /** Raw numeric value — shown on hover with full precision (e.g. R$ 1.234.567,89) */
  rawValue?: number;
  /** Ação intencional por duplo clique no card (ex.: abrir um drill-down). */
  onDoubleClick?: () => void;
}

/**
 * Resolve o "tone" automaticamente a partir de accentColor.
 * Assim os componentes que já passam accentColor ganham o gradiente certo.
 */
function resolveTone(accentColor?: string): "default" | "success" | "warning" | "danger" {
  if (!accentColor) return "default";
  if (accentColor.includes("success") || accentColor.includes("#4caf") || accentColor.includes("#3d6b") || accentColor.includes("#2d7a")) return "success";
  if (accentColor.includes("danger") || accentColor.includes("#b83a") || accentColor.includes("#9e3a") || accentColor.includes("#e060")) return "danger";
  if (accentColor.includes("warning") || accentColor.includes("#d4a0") || accentColor.includes("#8c5e")) return "warning";
  return "default";
}

const TONE_STYLES = {
  default: {
    border: "var(--voux-border-alpha)",
    bg: "bg-[var(--voux-surface)]",
    accent: "var(--voux-accent)",
  },
  success: {
    border: "color-mix(in srgb, var(--voux-border-alpha) 70%, var(--voux-success))",
    bg: "bg-gradient-to-br from-[rgba(122,155,111,0.06)] to-[var(--voux-surface)]",
    accent: "var(--voux-success)",
  },
  warning: {
    border: "color-mix(in srgb, var(--voux-border-alpha) 70%, var(--voux-warning))",
    bg: "bg-gradient-to-br from-[rgba(212,160,90,0.06)] to-[var(--voux-surface)]",
    accent: "var(--voux-warning)",
  },
  danger: {
    border: "color-mix(in srgb, var(--voux-border-alpha) 70%, var(--voux-danger))",
    bg: "bg-gradient-to-br from-[rgba(201,117,101,0.08)] to-[var(--voux-surface)]",
    accent: "var(--voux-danger)",
  },
} as const;

function DeltaBadge({ previousValue, trend, invertTrend }: { previousValue: string | number; trend: "up" | "down" | "neutral"; invertTrend?: boolean }) {
  const isPositive = invertTrend ? trend === "down" : trend === "up";
  const isNegative = invertTrend ? trend === "up" : trend === "down";

  // Design system: delta colors ALWAYS hardcoded
  const color = isPositive ? "#22c55e" : isNegative ? "#e74c3c" : "var(--voux-text-muted)";
  const TrendIcon = trend === "down" ? TrendingDown : trend === "neutral" ? Minus : TrendingUp;

  return (
    <div className="mt-2.5 flex items-center gap-1.5 text-xs font-semibold" style={{ color }}>
      <TrendIcon className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="font-mono">{previousValue} per. anterior</span>
    </div>
  );
}

export function KPICard({
  title, value, icon: Icon, hint, formula, loading = false, accentColor,
  previousValue, trend, invertTrend, rawValue, onDoubleClick,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const tone = resolveTone(accentColor);
  const config = TONE_STYLES[tone];

  return (
    <article
      className={cn(
        "group relative overflow-hidden rounded-2xl border p-5 transition-all duration-200",
        "hover:-translate-y-0.5 hover:shadow-[0_4px_16px_-4px_rgba(212,184,150,0.20)]",
        config.bg,
        onDoubleClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-accent)]",
      )}
      style={{
        borderColor: config.border,
        boxShadow: "var(--voux-card-shadow)",
      }}
      onMouseLeave={() => setShowTooltip(false)}
      onDoubleClick={onDoubleClick}
      onKeyDown={onDoubleClick ? (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onDoubleClick();
        }
      } : undefined}
      role={onDoubleClick ? "button" : undefined}
      tabIndex={onDoubleClick ? 0 : undefined}
      aria-label={onDoubleClick ? `${title}. Dê duplo clique para abrir os alertas.` : undefined}
    >
      {/* Decorative accent circle */}
      <div
        className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full opacity-[0.07]"
        style={{ background: config.accent }}
      />

      {/* Formula tooltip */}
      {showTooltip && formula && (
        <div
          className="absolute top-2 left-2 right-2 z-10 rounded-lg px-3 py-2 text-[11px] leading-tight"
          style={{
            background: "var(--voux-tooltip-bg)",
            border: "1px solid var(--voux-tooltip-border)",
            color: "var(--voux-tooltip-text)",
            fontFamily: "var(--voux-font-mono)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
          }}
        >
          {formula}
        </div>
      )}

      {/* Label */}
      <div className="flex items-start justify-between gap-2">
        <div
          className="text-xs font-mono tracking-[0.08em] uppercase font-semibold"
          style={{ color: config.accent }}
        >
          {title}
        </div>
        {formula ? (
          <button
            type="button"
            className="inline-flex h-5 w-5 items-center justify-center rounded-full shrink-0 transition-colors hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-accent)]"
            aria-label={`Explicacao: ${title}`}
            aria-expanded={showTooltip}
            onClick={() => setShowTooltip((visible) => !visible)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            style={{
              background: "color-mix(in srgb, var(--voux-accent) 12%, transparent)",
              color: config.accent,
            }}
          >
            <CircleHelp className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : Icon && (
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full shrink-0"
            style={{
              background: "color-mix(in srgb, var(--voux-accent) 12%, transparent)",
              color: config.accent,
            }}
          >
            <Icon className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <>
          <Skeleton className="h-8 w-24 mt-1.5 mb-1 bg-[var(--voux-skeleton)]" />
          {hint && <Skeleton className="h-3 w-32 bg-[var(--voux-skeleton)]" />}
        </>
      ) : (
        <>
          <div
            className={cn(
              "mt-1.5 font-mono font-bold leading-tight",
              String(value).length > 14
                ? "text-lg sm:text-xl md:text-2xl"
                : String(value).length > 10
                  ? "text-xl sm:text-2xl"
                  : "text-2xl sm:text-[28px]",
            )}
            style={{ color: "var(--voux-text-primary)" }}
            title={rawValue != null
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rawValue)
              : String(value)}
          >
            {value}
          </div>

          {/* Hint / scope */}
          {hint && (
            <div className="mt-1 text-xs" style={{ color: "var(--voux-text-muted)" }}>
              {hint}
            </div>
          )}

          {/* Delta */}
          {previousValue !== undefined && trend && (
            <DeltaBadge previousValue={previousValue} trend={trend} invertTrend={invertTrend} />
          )}
        </>
      )}
    </article>
  );
}
