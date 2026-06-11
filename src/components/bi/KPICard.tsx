import type { ElementType } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface KPICardProps {
  title: string;
  value: string | number;
  icon?: ElementType;
  hint?: string;
  loading?: boolean;
  accentColor?: string;
  /** Percentage variation vs previous period */
  delta?: number;
  /** Trend direction */
  trend?: "up" | "down" | "neutral";
  /** When true, a downward trend is positive (e.g. fewer losses) */
  invertTrend?: boolean;
  /** Span 2 columns on lg screens (hero card) */
  hero?: boolean;
}

function DeltaBadge({ delta, trend, invertTrend }: { delta: number; trend: "up" | "down" | "neutral"; invertTrend?: boolean }) {
  const arrow = trend === "up" ? "↑" : trend === "down" ? "↓" : "→";
  const isPositive = invertTrend ? trend === "down" : trend === "up";
  const isNegative = invertTrend ? trend === "up" : trend === "down";

  const color = isPositive
    ? "var(--voux-success, #4ade80)"
    : isNegative
      ? "var(--voux-danger, #f87171)"
      : "var(--voux-text-muted)";

  const label = `${trend === "up" ? "Aumento" : trend === "down" ? "Reducao" : "Sem variacao"} de ${Math.abs(delta).toFixed(1)} por cento em relacao ao periodo anterior`;

  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] font-medium mt-1.5"
      style={{ fontFamily: "var(--voux-font-mono)", color }}
    >
      <span aria-hidden="true">{arrow}</span>
      <span>{Math.abs(delta).toFixed(1)}%</span>
      <span className="sr-only">{label}</span>
    </span>
  );
}

export function KPICard({
  title, value, icon: Icon, hint, loading = false, accentColor,
  delta, trend, invertTrend, hero,
}: KPICardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[20px] p-[22px_24px]",
        "border",
        hero && "lg:col-span-2",
      )}
      style={{
        background: "linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
        ...(accentColor ? { borderLeftColor: accentColor, borderLeftWidth: 3 } : {}),
      }}
    >
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
          {delta !== undefined && trend && (
            <DeltaBadge delta={delta} trend={trend} invertTrend={invertTrend} />
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
