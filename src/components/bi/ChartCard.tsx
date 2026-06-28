import { type ReactNode, useState } from "react";
import { Database } from "lucide-react";
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
  dataSource?: string;
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
  dataSource,
}: ChartCardProps) {
  const [showDataSource, setShowDataSource] = useState(false);

  return (
    <div
      role="figure"
      aria-label={title}
      className={cn("rounded-2xl overflow-hidden bg-[var(--surface-raised)]", className)}
      style={{
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
            className="text-[15px] font-medium leading-snug tracking-[-0.01em] inline-flex items-center gap-1"
            style={{ fontFamily: "var(--voux-font-sans)", color: "var(--voux-text-heading)" }}
          >
            {title}
            {infoTooltip && <InfoTooltip text={infoTooltip} />}
            {dataSource && (
              <span className="relative inline-flex">
                <span
                  className="cursor-help"
                  aria-label="Origem dos dados"
                  style={{ color: "var(--voux-text-faint)", opacity: 0.6 }}
                  onMouseEnter={() => setShowDataSource(true)}
                  onMouseLeave={() => setShowDataSource(false)}
                >
                  <Database className="h-3.5 w-3.5" />
                </span>
                {showDataSource && (
                  <div
                    className="absolute z-20 rounded-lg px-3 py-2 text-[11px] leading-snug"
                    style={{
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "var(--voux-tooltip-bg)",
                      border: "1px solid var(--voux-tooltip-border)",
                      color: "var(--voux-tooltip-text)",
                      fontFamily: "var(--voux-font-mono)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      maxWidth: 340,
                      whiteSpace: "normal",
                      fontWeight: 400,
                    }}
                  >
                    {dataSource}
                  </div>
                )}
              </span>
            )}
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
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
