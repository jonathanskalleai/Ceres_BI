import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { truncateObs } from "@/components/dashboard/useDashboardAdminDetail";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { PaginationControls } from "@/components/bi/PaginationControls";
import type { AcoesDetalheItem } from "@/types/biRpc";

/** Chars da observacao mostrados inline; o resto so na linha expandida. */
const OBS_INLINE_CHARS = 90;

const TH = "text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]";

interface Props {
  rows: AcoesDetalheItem[];
  /** COUNT real do servidor (respeitando filtros). */
  total: number;
  /** Pagina atual (1-based). */
  page: number;
  pageSize: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  error?: Error | null;
}

function matches(row: AcoesDetalheItem, term: string): boolean {
  return [row.consultor, row.cliente, row.cidade, row.tipoAcao, row.tipoContato, row.observacao, row.observacaoNegocio, row.produto, row.data, row.etapa]
    .some((v) => (v ?? "").toLowerCase().includes(term));
}

interface RowProps {
  row: AcoesDetalheItem;
  index: number;
  expanded: boolean;
  onToggle: () => void;
}

function AcoesDetailRow({ row, index, expanded, onToggle }: RowProps) {
  const panelId = `acao-obs-${index}`;
  const zebra = index % 2 === 1 ? "bg-foreground/[0.02]" : "";

  return (
    <>
      <tr className={`border-t border-[var(--voux-card-border)]/30 ${zebra}`}>
        <td className="py-2 pr-2 tabular-nums text-[var(--voux-text-primary)] whitespace-nowrap">{row.data}</td>
        <td className="py-2 px-2 text-[var(--voux-text-primary)] truncate max-w-[140px]">{row.consultor ?? "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-primary)] truncate max-w-[180px]">{row.cliente ?? "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-soft)] truncate max-w-[120px]">{row.cidade ?? "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-soft)] truncate max-w-[130px]">{row.tipoAcao ?? "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-soft)] truncate max-w-[110px]">{row.tipoContato ?? "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-soft)] truncate max-w-[120px]">{row.etapa ?? "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-primary)] truncate max-w-[180px]" title={row.produto ?? undefined}>{row.produto ?? "— sem produto vinculado —"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-primary)] tabular-nums whitespace-nowrap">{row.valor != null ? `R$ ${row.valor.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}` : "—"}</td>
        <td className="py-2 px-2 text-[var(--voux-text-soft)] max-w-[340px]">
          <span className="block truncate">{truncateObs(row.observacao ?? undefined, OBS_INLINE_CHARS)}</span>
        </td>
        <td className="py-2 px-2 text-[var(--voux-text-soft)] max-w-[300px]" title={row.observacaoNegocio ?? undefined}>
          <span className="block truncate">{truncateObs(row.observacaoNegocio ?? undefined, OBS_INLINE_CHARS)}</span>
        </td>
        <td className="py-2 pl-2 w-8">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            aria-controls={expanded ? panelId : undefined}
            aria-label={expanded ? `Recolher detalhes da acao de ${row.data}` : `Expandir detalhes da acao de ${row.data}`}
            className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--voux-text-muted)] hover:bg-foreground/5 hover:text-[var(--voux-text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)] transition-colors"
          >
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          </button>
        </td>
      </tr>
      {expanded && (
        <tr className={zebra}>
          <td colSpan={12} className="p-0">
            <div id={panelId} className="px-3 py-3 bg-foreground/[0.03] border-t border-[var(--voux-card-border)]/30 space-y-2">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[11px]">
                <div>
                  <span className="text-[var(--voux-text-muted)]">Cliente</span>
                  <p className="font-medium text-[var(--voux-text-primary)]">{row.cliente ?? "—"}</p>
                </div>
                <div>
                  <span className="text-[var(--voux-text-muted)]">Cidade</span>
                  <p className="font-medium text-[var(--voux-text-primary)]">{row.cidade ?? "—"}</p>
                </div>
                <div>
                  <span className="text-[var(--voux-text-muted)]">Tipo de Acao</span>
                  <p className="font-medium text-[var(--voux-text-primary)]">{row.tipoAcao ?? "—"}</p>
                </div>
                <div>
                  <span className="text-[var(--voux-text-muted)]">Tipo de Contato</span>
                  <p className="font-medium text-[var(--voux-text-primary)]">{row.tipoContato ?? "—"}</p>
                </div>
                <div>
                  <span className="text-[var(--voux-text-muted)]">Produto(s) do negocio</span>
                  <p className="font-medium text-[var(--voux-text-primary)]">{row.produto ?? "— sem produto vinculado —"}</p>
                </div>
              </div>
              <div>
                <span className="text-[11px] text-[var(--voux-text-muted)]">Observacao completa da acao</span>
                <p className="mt-1 text-xs leading-relaxed text-[var(--voux-text-primary)] whitespace-pre-wrap">
                  {row.observacao?.trim() ? row.observacao : "— sem observacao registrada —"}
                </p>
              </div>
              <div>
                <span className="text-[11px] text-[var(--voux-text-muted)]">Observacao do negocio</span>
                <p className="mt-1 text-xs leading-relaxed text-[var(--voux-text-primary)] whitespace-pre-wrap">
                  {row.observacaoNegocio?.trim() ? row.observacaoNegocio : "— sem observacao registrada —"}
                </p>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/**
 * Tabela "Acoes do Periodo" — paginacao server-side com controles numerados.
 *
 * O search box filtra client-side DENTRO da pagina atual (refinar sem round-trip).
 * Para filtrar no servidor inteiro, usar os chips de status/vendedor/cidade.
 */
export function AcoesDetailTable({ rows, total, page, pageSize, totalPages, onPageChange, loading, error }: Props) {
  const [search, setSearch] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => matches(r, term));
  }, [rows, search]);

  const isEmpty = rows.length === 0 && total === 0;

  // Range label: "Mostrando 1-50 de 320"
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const rangeLabel = total > 0
    ? `Mostrando ${rangeStart.toLocaleString("pt-BR")}–${rangeEnd.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`
    : undefined;

  // Counter for the title
  const counter = search.trim()
    ? `${filtered.length.toLocaleString("pt-BR")} encontradas na pagina`
    : `${total.toLocaleString("pt-BR")} acoes`;

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--voux-text-muted)]" aria-hidden="true" />
      <input
        type="search"
        value={search}
        onChange={(e) => { setSearch(e.target.value); setExpandedIndex(null); }}
        placeholder="Buscar cliente, produto, observacao..."
        aria-label="Buscar nas acoes do periodo"
        className="h-8 w-full sm:w-72 rounded-md border border-[var(--voux-card-border)] bg-transparent pl-8 pr-2 text-xs text-[var(--voux-text-primary)] placeholder:text-[var(--voux-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
      />
    </div>
  );

  const footer = (
    <PaginationControls
      page={page}
      totalPages={totalPages}
      onPageChange={onPageChange}
      rangeLabel={rangeLabel}
    />
  );

  return (
    <BiTableCard
      title={isEmpty ? "Acoes do Periodo" : `Acoes do Periodo · ${counter}`}
      actions={searchBox}
      loading={loading}
      error={error}
      isEmpty={isEmpty}
      emptyMessage="Nenhuma acao no periodo selecionado."
      skeletonRows={8}
      footer={footer}
    >
      <div className="overflow-x-auto max-h-[560px] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[var(--voux-card-from)] z-10">
            <tr>
              <th className="text-left py-2 pr-2 font-medium text-[var(--voux-text-muted)]">Data</th>
              <th className={TH}>Consultor</th>
              <th className={TH}>Cliente</th>
              <th className={TH}>Cidade</th>
              <th className={TH}>Tipo Acao</th>
              <th className={TH}>Contato</th>
              <th className={TH}>Etapa</th>
              <th className={TH}>Produto(s)</th>
              <th className={TH}>Valor</th>
              <th className={TH}>Obs. Acao</th>
              <th className={TH}>Obs. Negocio</th>
              <th className="py-2 pl-2 w-8"><span className="sr-only">Detalhes</span></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <AcoesDetailRow
                key={`${row.dataIso}-${row.cliente ?? ""}-${i}`}
                row={row}
                index={i}
                expanded={expandedIndex === i}
                onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              />
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-[var(--voux-text-muted)]">
                  {search.trim() ? "Nenhuma acao corresponde a busca." : "Nenhuma acao nesta pagina."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BiTableCard>
  );
}
