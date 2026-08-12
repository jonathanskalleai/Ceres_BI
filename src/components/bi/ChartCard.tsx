import { type ReactNode, useState } from "react";
import { CircleHelp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface ChartCardProps {
  title: string;
  description?: string;
  /** Texto complementar legado; usado somente quando nao houver descricao. */
  infoTooltip?: string;
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
  height = 280,
  loading = false,
  className,
  children,
  label,
  actions,
  footer,
}: ChartCardProps) {
  const [showDescription, setShowDescription] = useState(false);
  // A explicacao funcional e a descricao. A origem tecnica continua aceita na
  // API do componente para nao exigir mudancas em todos os cards, mas nao e
  // apresentada na interface.
  const helpText = description || infoTooltip;

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
            {helpText && (
              <span
                className="relative inline-flex"
                onMouseLeave={() => setShowDescription(false)}
              >
                <button
                  type="button"
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full transition-colors hover:text-[var(--voux-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-accent)]"
                  aria-label={`Explicacao: ${title}`}
                  aria-expanded={showDescription}
                  onClick={() => setShowDescription((visible) => !visible)}
                  onFocus={() => setShowDescription(true)}
                  onBlur={() => setShowDescription(false)}
                  style={{ color: "var(--voux-text-faint)" }}
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
                      background: "var(--voux-tooltip-bg)",
                      border: "1px solid var(--voux-tooltip-border)",
                      color: "var(--voux-tooltip-text)",
                      fontFamily: "var(--voux-font-mono)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
                      maxWidth: 340,
                      minWidth: 180,
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
      <div className="px-5 pb-5">
        {loading ? (
          <Skeleton className="w-full rounded-xl" style={{ height, background: "var(--voux-skeleton)" }} />
        ) : (
          <div style={{ height }} className="w-full">
            {children}
          </div>
        )}
        {footer && <div className="mt-3 border-t border-[var(--voux-card-border)] pt-3">{footer}</div>}
      </div>
    </div>
  );
}
