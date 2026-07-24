import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { AcoesDetailTable } from "@/components/bi/AcoesDetailTable";
import type { AcoesDetalheItem } from "@/types/biRpc";

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "Em Aberto", label: "Em Aberto" },
  { value: "Ganho", label: "Ganho" },
  { value: "Perdido", label: "Perdido" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  "": "border-[var(--voux-card-border)] text-[var(--voux-text-primary)]",
  "Em Aberto": "border-[var(--voux-champagne-400)] text-[var(--voux-champagne-400)]",
  "Ganho": "border-[#1f6e3f] text-[#1f6e3f]",
  "Perdido": "border-[#b8421c] text-[#b8421c]",
};

interface Props {
  rows: AcoesDetalheItem[];
  total: number;
  loading?: boolean;
  error?: Error | null;
}

/**
 * Status filter chips + AcoesDetailTable with contextual badge.
 * Extracted from AcoesSection to keep component sizes under 200 lines.
 */
export function AcoesDetailWithFilter({ rows, total, loading, error }: Props) {
  const { statusNegocio, setStatusNegocio } = useNegociosFilter();

  return (
    <div className="space-y-3">
      {/* Status filter chips */}
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filtrar por status do negocio">
        <span className="text-xs text-[var(--voux-text-muted)] mr-1">Status:</span>
        {STATUS_OPTIONS.map(({ value, label }) => {
          const active = statusNegocio === value;
          const colorClass = STATUS_COLORS[value] ?? STATUS_COLORS[""];
          return (
            <button
              key={value}
              type="button"
              onClick={() => setStatusNegocio(value)}
              aria-pressed={active}
              className={`h-7 rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)] ${colorClass} ${
                active ? "bg-foreground/10" : "bg-transparent hover:bg-foreground/5"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Info badge when status filter active */}
      {statusNegocio && (
        <p className="text-[11px] text-[var(--voux-text-muted)] italic">
          Filtrando por status: {statusNegocio} — acoes sem negocio vinculado nao sao exibidas
        </p>
      )}

      <AcoesDetailTable rows={rows} total={total} loading={loading} error={error} />
    </div>
  );
}
