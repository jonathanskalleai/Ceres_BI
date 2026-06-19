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
        "relative overflow-hidden rounded-[20px] p-[22px_24px]",
        "border",
      )}
      style={{
        background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
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
            background: "var(--voux-bg, #0f0f0f)",
            border: "1px solid var(--voux-card-border)",
            color: "var(--voux-text-soft)",
            fontFamily: "var(--voux-font-mono)",
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
        >
          {formula}
        </div>
      )}

      {/* Eyebrow */}
      <div className="flex items-center justify-between mb-4">
        <span
          className="text-[10px] tracking-[0.22em] uppercase"
          style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
        >
          {title}
        </span>
        {Icon && <Icon className="h-3.5 w-3.5 opacity-40" style={{ color: "var(--voux-text-muted)" }} />}
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
            className="text-[28px] font-bold leading-none tracking-[-0.02em] mb-1"
            style={{ color: accentColor || "var(--voux-text-primary)" }}
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
