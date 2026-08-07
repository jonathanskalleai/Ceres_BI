import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  /** "Mostrando X–Y de Z" — exibido a esquerda do controle. */
  rangeLabel?: string;
}

/** Max page buttons visible (excluding prev/next). */
const MAX_VISIBLE = 7;

/**
 * Generates the array of page numbers + ellipsis markers to render.
 * Always shows first, last, current, and neighbors — fills with ellipsis.
 */
function getPageNumbers(current: number, total: number): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= MAX_VISIBLE) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis-start" | "ellipsis-end")[] = [1];

  const rangeStart = Math.max(2, current - 1);
  const rangeEnd = Math.min(total - 1, current + 1);

  if (rangeStart > 2) pages.push("ellipsis-start");

  for (let i = rangeStart; i <= rangeEnd; i++) {
    pages.push(i);
  }

  if (rangeEnd < total - 1) pages.push("ellipsis-end");

  pages.push(total);
  return pages;
}

const BTN_BASE =
  "inline-flex items-center justify-center h-7 w-7 rounded-full text-xs font-mono transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]";
const BTN_ACTIVE =
  "bg-[var(--voux-champagne-400)] text-[var(--voux-bg)] font-semibold";
const BTN_INACTIVE =
  "border border-[var(--voux-card-border)] text-[var(--voux-text-primary)] hover:bg-foreground/5";
const BTN_DISABLED = "opacity-50 cursor-not-allowed";

/**
 * Pagination numerada VOUX — max 7 botoes visiveis + ellipsis.
 * Acessibilidade: aria-label em cada botao, aria-current na pagina ativa, role=navigation no container.
 */
export function PaginationControls({ page, totalPages, onPageChange, rangeLabel }: Props) {
  if (totalPages <= 1) return null;

  const pages = getPageNumbers(page, totalPages);

  return (
    <nav
      role="navigation"
      aria-label="Paginacao da tabela de acoes"
      className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
    >
      {rangeLabel ? (
        <span className="text-[11px] font-mono uppercase tracking-[0.22em] text-[var(--voux-text-muted)]">
          {rangeLabel}
        </span>
      ) : (
        <span />
      )}

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Pagina anterior"
          className={`${BTN_BASE} ${page <= 1 ? BTN_DISABLED : BTN_INACTIVE}`}
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Page numbers */}
        {pages.map((p) => {
          if (p === "ellipsis-start" || p === "ellipsis-end") {
            return (
              <span
                key={p}
                className="inline-flex h-7 w-7 items-center justify-center text-xs text-[var(--voux-text-muted)]"
                aria-hidden="true"
              >
                ...
              </span>
            );
          }
          const isActive = p === page;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              aria-label={`Pagina ${p}`}
              aria-current={isActive ? "page" : undefined}
              className={`${BTN_BASE} ${isActive ? BTN_ACTIVE : BTN_INACTIVE}`}
            >
              {p}
            </button>
          );
        })}

        {/* Next */}
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Proxima pagina"
          className={`${BTN_BASE} ${page >= totalPages ? BTN_DISABLED : BTN_INACTIVE}`}
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  );
}
