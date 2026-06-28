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
  dataSource?: string;
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
  previousValue, trend, invertTrend, dataSource,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl px-4 py-3 md:px-5 md:py-3.5 transition-colors",
        "border bg-[var(--surface-raised)]",
      )}
      style={{
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
        ...(accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : {}),
      }}
      onMouseEnter={() => (formula || dataSource) && setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Formula + data source tooltip */}
      {showTooltip && (formula || dataSource) && (
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
          {formula && <div>{formula}</div>}
          {formula && dataSource && (
            <div style={{ borderTop: "1px solid var(--voux-tooltip-border)", marginTop: 6, paddingTop: 6, opacity: 0.7, fontSize: "10px" }}>
              {dataSource}
            </div>
          )}
          {!formula && dataSource && <div>{dataSource}</div>}
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
        {Icon && (
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
            title={String(value)}
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

