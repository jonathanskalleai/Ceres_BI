import { type ReactNode, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Texto complementar legado; usado somente quando nao houver descricao. */
  infoTooltip?: string;
  /** Altura do conteúdo. Quando omitido o card se ajusta ao conteúdo. */
  height?: number;
  loading?: boolean;
  className?: string;
  children: ReactNode;
  label?: string;
  dataSource?: string;
  /** Slot a direita do titulo (chips de filtro, toggle, contador). */
  actions?: ReactNode;
  /** Rodape do card — legendas/ressalvas que nao podem sumir do grafico. */
  footer?: ReactNode;
}

export function ChartCard({
  title,
  description,
  infoTooltip,
  height,
  loading = false,
  className,
  children,
  label,
  actions,
  footer,
}: ChartCardProps) {
  const [showDescription, setShowDescription] = useState(false);
  const helpText = description || infoTooltip;

  return (
    <div
      role="figure"
      aria-label={title}
      className={cn("voux-card flex flex-col p-6", className)}
    >
      {/* Header — padrão VOUX: eyebrow mono + título semibold */}
      <div className="mb-4 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {label && (
            <div
              className="text-xs font-semibold tracking-[0.08em] uppercase mb-0.5"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              {label}
            </div>
          )}
          <h3
            className="text-base font-semibold leading-tight inline-flex items-center gap-1.5"
            style={{ color: "var(--voux-text-primary)" }}
          >
            {title}
            {helpText && (
              <span
                className="relative inline-flex"
                onMouseLeave={() => setShowDescription(false)}
              >
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full opacity-40 hover:opacity-70 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-accent)]"
                  aria-label={`Explicação: ${title}`}
                  aria-expanded={showDescription}
                  onClick={() => setShowDescription((v) => !v)}
                  onFocus={() => setShowDescription(true)}
                  onBlur={() => setShowDescription(false)}
                >
                  <CircleHelp className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                {showDescription && (
                  <div
                    role="tooltip"
                    className="absolute z-20 rounded-lg px-3 py-2 text-[11px] leading-snug"
                    style={{
                      top: "100%",
                      left: 0,
                      marginTop: 4,
                      background: "var(--voux-chart-tooltip-bg, rgba(10,9,7,0.92))",
                      border: "1px solid var(--voux-chart-tooltip-border, rgba(212,184,150,0.2))",
                      color: "var(--voux-chart-tooltip-text, #ece5d4)",
                      fontFamily: "var(--voux-font-mono)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                      borderRadius: 8,
                      maxWidth: 320,
                      minWidth: 160,
                      whiteSpace: "normal",
                      fontWeight: 400,
                    }}
                  >
                    {helpText}
                  </div>
                )}
              </span>
            )}
          </h3>
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>

      {/* Content */}
      {loading ? (
        <Skeleton
          className="w-full rounded-xl"
          style={{ height: height ?? 200, background: "var(--voux-skeleton)" }}
        />
      ) : (
        <div
          className="w-full min-w-0"
          style={height ? { minHeight: height } : undefined}
        >
          {children}
        </div>
      )}

      {/* Footer */}
      {footer && (
        <div className="mt-4 border-t pt-3" style={{ borderColor: "var(--voux-card-border)" }}>
          {footer}
        </div>
      )}
    </div>
  );
}
