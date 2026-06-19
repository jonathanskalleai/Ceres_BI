import { type ElementType, useState } from "react";
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
}

function DeltaBadge({ previousValue, trend, invertTrend }: { previousValue: string | number; trend: "up" | "down" | "neutral"; invertTrend?: boolean }) {
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const isPositive = invertTrend ? trend === "down" : trend === "up";
  const isNegative = invertTrend ? trend === "up" : trend === "down";

  const color = isPositive
    ? "var(--voux-success, #4ade80)"
    : isNegative
      ? "var(--voux-danger, #f87171)"
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
  previousValue, trend, invertTrend,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 md:p-6 transition-colors",
        "border bg-[var(--surface-raised)]",
      )}
      style={{
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
        ...(accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : {}),
      }}
      onMouseEnter={() => formula && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
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

      {/* Eyebrow */}
      <div className="flex items-start justify-between mb-3 md:mb-4 gap-2">
        <span
          className="text-[10px] tracking-[0.14em] uppercase leading-snug"
          style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
        >
          {title}
        </span>
        {Icon && (
          <span
            className="inline-flex h-7 w-7 items-center justify-center rounded-full shrink-0"
            style={{
              background: "color-mix(in srgb, var(--voux-accent) 12%, transparent)",
              color: "var(--voux-accent)",
            }}
          >
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>

      {/* Value */}
      {loading ? (
        <>
          <Skeleton className="h-8 w-24 mb-2 bg-[var(--voux-skeleton)]" />
          {hint && <Skeleton className="h-3 w-32 bg-[var(--voux-skeleton)]" />}
        </>
      ) : (
        <>
          <div
            className="text-xl sm:text-2xl md:text-[26px] font-semibold leading-none tracking-[-0.02em] mb-1 truncate"
            style={{ color: accentColor || "var(--voux-text-heading)" }}
            title={String(value)}
          >
            {value}
          </div>

          {previousValue !== undefined && trend && (
            <DeltaBadge previousValue={previousValue} trend={trend} invertTrend={invertTrend} />
          )}
          {hint && (
            <p className="text-[11px] mt-2" style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}>
              {hint}
            </p>
          )}
        </>
      )}
    </div>
  );
}

