import { type ElementType, useState } from "react";
import { CircleHelp } from "lucide-react";
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

function DeltaBadge({ previousValue, trend, invertTrend }: { previousValue: string | number; trend: "up" | "down" | "neutral"; invertTrend?: boolean }) {
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const isPositive = invertTrend ? trend === "down" : trend === "up";
  const isNegative = invertTrend ? trend === "up" : trend === "down";

  const color = isPositive
    ? "var(--voux-success)"
    : isNegative
      ? "var(--voux-danger)"
      : "var(--voux-text-muted)";

  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium mt-1.5"
      style={{ fontFamily: "var(--voux-font-mono)", color }}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{previousValue} per. anterior</span>
      <span className="sr-only">Periodo anterior: {previousValue}</span>
    </span>
  );
}

export function KPICard({
  title, value, icon: Icon, hint, formula, loading = false, accentColor,
  previousValue, trend, invertTrend, rawValue, onDoubleClick,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl px-4 py-3 md:px-5 md:py-3.5 transition-colors",
        "border bg-[var(--surface-raised)]",
        onDoubleClick && "cursor-pointer hover:border-[var(--voux-champagne-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]",
      )}
      style={{
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
        ...(accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : {}),
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
      {/* A explicacao aparece apenas sob demanda; a origem tecnica nao e exibida. */}
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

      {/* Eyebrow */}
      <div className="flex items-start justify-between mb-2 gap-2">
        <span
          className="text-[11px] tracking-[0.12em] uppercase leading-snug font-medium"
          style={{ fontFamily: "var(--voux-font-label)", color: "var(--voux-label)" }}
        >
          {title}
        </span>
        {formula ? (
          <button
            type="button"
            className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0 transition-colors hover:bg-[var(--voux-accent)]/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-accent)]"
            aria-label={`Explicacao: ${title}`}
            aria-expanded={showTooltip}
            onClick={() => setShowTooltip((visible) => !visible)}
            onFocus={() => setShowTooltip(true)}
            onBlur={() => setShowTooltip(false)}
            style={{
              background: "color-mix(in srgb, var(--voux-accent) 12%, transparent)",
              color: "var(--voux-accent)",
            }}
          >
            <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : Icon && (
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full shrink-0"
            style={{
              background: "color-mix(in srgb, var(--voux-accent) 12%, transparent)",
              color: "var(--voux-accent)",
            }}
          >
            <Icon className="h-3 w-3" />
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <>
          <Skeleton className="h-8 w-24 mb-1 bg-[var(--voux-skeleton)]" />
          {hint && <Skeleton className="h-3 w-32 bg-[var(--voux-skeleton)]" />}
        </>
      ) : (
        <>
          <div
            className={cn(
              "font-semibold leading-none tracking-[-0.02em] tabular-nums",
              String(value).length > 14
                ? "text-lg sm:text-xl md:text-2xl"
                : String(value).length > 10
                  ? "text-xl sm:text-2xl md:text-[28px]"
                  : "text-2xl sm:text-[28px] md:text-[32px]",
            )}
            style={{ color: accentColor || "var(--voux-text-heading)" }}
            title={rawValue != null
              ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(rawValue)
              : String(value)}
          >
            {value}
          </div>

          {previousValue !== undefined && trend && (
            <DeltaBadge previousValue={previousValue} trend={trend} invertTrend={invertTrend} />
          )}
          {hint && (
            <p className="text-[11px] mt-1" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  );
}
