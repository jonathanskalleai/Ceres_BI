import type { ReactNode } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

interface ChartCardProps {
  title: string;
  description?: string;
  infoTooltip?: string;
  height?: number;
  loading?: boolean;
  className?: string;
  children: ReactNode;
  label?: string;
}

export function ChartCard({
  title,
  description,
  infoTooltip,
  height = 280,
  loading = false,
  className,
  children,
  label,
}: ChartCardProps) {
  return (
    <div
      className={cn("rounded-[16px] overflow-hidden", className)}
      style={{
        background: `linear-gradient(to bottom, var(--voux-card-from), var(--voux-card-to))`,
        border: `1px solid var(--voux-card-border)`,
        boxShadow: `var(--voux-card-shadow)`,
      }}
    >
      {/* Card header */}
      <div className="flex items-start justify-between p-5 pb-3">
        <div className="flex flex-col gap-1 min-w-0">
          {label && (
            <span
              className="text-[9px] tracking-[0.28em] uppercase"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              {label}
            </span>
          )}
          <h3
            className="text-[15px] font-medium leading-snug tracking-[-0.01em]"
            style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-heading)" }}
          >
            {title}
            {infoTooltip && <InfoTooltip text={infoTooltip} />}
          </h3>
          {description && (
            <p
              className="text-[11px]"
              style={{ fontFamily: "var(--voux-font-mono)", letterSpacing: "0.02em", color: "var(--voux-text-faint)" }}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 pb-5">
        {loading ? (
          <Skeleton className="w-full rounded-xl" style={{ height, background: "var(--voux-skeleton)" }} />
        ) : (
          <div style={{ minHeight: height }} className="w-full">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
