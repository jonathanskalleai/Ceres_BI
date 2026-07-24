import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { truncateObs } from "@/components/dashboard/useDashboardAdminDetail";
import { BiTableCard } from "@/components/bi/BiTableCard";
import type { AcoesDetalheItem } from "@/types/biRpc";

/** Linhas exibidas por pagina no cliente ("Carregar mais" soma outra pagina). */
const PAGE_SIZE = 100;
/** Chars da observacao mostrados inline; o resto so na linha expandida. */
const OBS_INLINE_CHARS = 90;

const TH = "text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]";

interface Props {
  rows: AcoesDetalheItem[];
  /** COUNT real do periodo no servidor — maior que rows.length quando a RPC truncou. */
  total: number;
  loading?: boolean;
  /** Erro da RPC. Sem isto uma falha de query viraria "nenhuma acao no periodo". */
  error?: Error | null;
}

function matches(row: AcoesDetalheItem, term: string): boolean {
  return [row.consultor, row.cliente, row.cidade, row.tipoAcao, row.tipoContato, row.observacao, row.data]
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
        <td className="py-2 px-2 text-[var(--voux-text-soft)] max-w-[340px]">
          <span className="block truncate">{truncateObs(row.observacao ?? undefined, OBS_INLINE_CHARS)}</span>
        </td>
        <td className="py-2 pl-2 w-8">
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            // aria-controls so aponta para o painel quando ele existe no DOM: apontar
            // para um id inexistente e uma promessa quebrada ao leitor de tela.
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
          <td colSpan={8} className="p-0">
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
              </div>
              <div>
                <span className="text-[11px] text-[var(--voux-text-muted)]">Observacao completa</span>
                <p className="mt-1 text-xs leading-relaxed text-[var(--voux-text-primary)] whitespace-pre-wrap">
                  {row.observacao?.trim() ? row.observacao : "— sem observacao registrada —"}
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
 * Tabela "Acoes do Periodo" — detalhe COMPLETO do periodo filtrado.
 *
 * `rows` vem paginada do servidor (rpc_acoes_detalhe, teto de 2.000 linhas) e
 * `total` e o COUNT real: quando `total > rows.length` o rodape avisa que a lista
 * esta truncada em vez de mentir por omissao.
 */
export function AcoesDetailTable({ rows, total, loading, error }: Props) {
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => matches(r, term));
  }, [rows, search]);

  // Novo filtro/busca = volta para a primeira pagina e fecha a linha aberta
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
    setExpandedIndex(null);
  }, [rows, search]);

  const visible = filtered.slice(0, visibleCount);
  const truncatedByServer = total > rows.length;
  const isEmpty = rows.length === 0;
  const counter = search.trim()
    ? `${visible.length.toLocaleString("pt-BR")} de ${filtered.length.toLocaleString("pt-BR")} (filtradas)`
    : `${visible.length.toLocaleString("pt-BR")} de ${rows.length.toLocaleString("pt-BR")}`;

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--voux-text-muted)]" aria-hidden="true" />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar cliente, consultor, observacao..."
        aria-label="Buscar nas acoes do periodo"
        className="h-8 w-full sm:w-72 rounded-md border border-[var(--voux-card-border)] bg-transparent pl-8 pr-2 text-xs text-[var(--voux-text-primary)] placeholder:text-[var(--voux-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
      />
    </div>
  );

  const footer = (
    <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
      {visibleCount < filtered.length ? (
        <button
          type="button"
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="h-8 rounded-full border border-[var(--voux-card-border)] px-4 text-xs font-medium text-[var(--voux-text-primary)] hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)] transition-colors"
        >
          Carregar mais {Math.min(PAGE_SIZE, filtered.length - visibleCount).toLocaleString("pt-BR")}
        </button>
      ) : (
        <span />
      )}
      {truncatedByServer && (
        <p className="text-[11px] text-[var(--voux-text-muted)]">
          Mostrando {rows.length.toLocaleString("pt-BR")} de {total.toLocaleString("pt-BR")} acoes do periodo — refine o filtro para ver o restante.
        </p>
      )}
    </div>
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
              <th className={TH}>Observacao</th>
              <th className="py-2 pl-2 w-8"><span className="sr-only">Detalhes</span></th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row, i) => (
              <AcoesDetailRow
                key={`${row.dataIso}-${row.cliente ?? ""}-${i}`}
                row={row}
                index={i}
                expanded={expandedIndex === i}
                onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
              />
            ))}
            {visible.length === 0 && (
              <tr>
                <td colSpan={8} className="py-6 text-center text-[var(--voux-text-muted)]">
                  Nenhuma acao corresponde a busca.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BiTableCard>
  );
}
