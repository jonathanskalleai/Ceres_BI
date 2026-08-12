import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { PaginationControls } from "@/components/bi/PaginationControls";
import { formatDateTimeBR } from "@/lib/dateUtils";
import type { AcoesEmAndamentoRow } from "@/services/bi/acoesEmAndamentoService";
import { EM_ANDAMENTO_PAGE_SIZE } from "@/hooks/bi/useEmAndamentoRpc";

const TH = "text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]";
const TD = "py-2 px-2 text-[var(--voux-text-primary)]";
const DASH = "—";

const brl = (v: number | null) =>
  v != null ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 }) : DASH;

function matches(row: AcoesEmAndamentoRow, term: string): boolean {
  return [row.cliente, row.cidade, row.consultor, row.negocioNumero, row.etapa, row.produto, row.observacaoNegocio, row.ultimaAcao]
    .some((v) => (v ?? "").toLowerCase().includes(term));
}

interface Props {
  rows: AcoesEmAndamentoRow[];
  total: number;
  page: number;
  pageSize?: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  error?: Error | null;
}

/**
 * Tabela de negócios em andamento — Story 5-A drill-down.
 * 12 colunas: Nº Negocio | Cliente | Cidade | Consultor | Etapa | Produto |
 * Obs. | Valor | Última Ação | Data da Ação | Criado em | Dias Parado.
 * Ordenacao: diasParado DESC (veem da RPC).
 * Destaque: diasParado > 90 → valor em vermelho (mesma convencao do mapa).
 * Badge: "Mostrando negocios em andamento — fonte: crm_acoes + crm_negocios · estado atual."
 */
export function AcoesEmAndamentoTable({ rows, total, page, pageSize = EM_ANDAMENTO_PAGE_SIZE, onPageChange, loading, error }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => matches(r, term));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);
  const rangeLabel = total > 0
    ? `Mostrando ${rangeStart.toLocaleString("pt-BR")}–${rangeEnd.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`
    : undefined;

  const counter = search.trim()
    ? `${filtered.length.toLocaleString("pt-BR")} encontrados na pagina`
    : `${total.toLocaleString("pt-BR")} negocios`;

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--voux-text-muted)]" aria-hidden="true" />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar negocio, cliente, produto..."
        aria-label="Buscar nos negocios em andamento"
        className="h-8 w-full sm:w-64 rounded-md border border-[var(--voux-card-border)] bg-transparent pl-8 pr-2 text-xs text-[var(--voux-text-primary)] placeholder:text-[var(--voux-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
      />
    </div>
  );

  const badge = (
    <p className="text-[11px] italic text-[var(--voux-text-muted)]">
      Mostrando negocios em andamento — fonte: crm_acoes + crm_negocios · estado atual.
    </p>
  );

  return (
    <BiTableCard
      title={`Em Andamento · ${counter}`}
      actions={searchBox}
      loading={loading}
      error={error}
      isEmpty={rows.length === 0 && total === 0}
      emptyMessage="Nenhum negocio em andamento no periodo selecionado."
      skeletonRows={8}
      footer={
        <>
          {badge}
          <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} rangeLabel={rangeLabel} />
        </>
      }
    >
      <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[var(--voux-card-from)] z-10">
            <tr>
              <th className={TH}>Nº Negocio</th>
              <th className={TH}>Cliente</th>
              <th className={TH}>Cidade</th>
              <th className={TH}>Consultor</th>
              <th className={TH}>Etapa</th>
              <th className={TH}>Produto(s)</th>
              <th className={TH}>Obs. Negocio</th>
              <th className={`${TH} text-right`}>Valor</th>
              <th className={TH}>Ultima Acao</th>
              <th className={TH}>Última ação em</th>
              <th className={TH}>Criado em</th>
              <th className={`${TH} text-right`}>Dias Parado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const isStale = row.diasParado > 90;
              const zebra = i % 2 === 1 ? "bg-foreground/[0.02]" : "";
              return (
                <tr key={`${row.negocioNumero}-${i}`} className={`border-t border-[var(--voux-card-border)]/30 ${zebra}`}>
                  <td className={`${TD} tabular-nums font-mono`}>{row.negocioNumero}</td>
                  <td className={`${TD} max-w-[160px] truncate`}>{row.cliente ?? DASH}</td>
                  <td className={`${TD} text-[var(--voux-text-soft)] max-w-[110px] truncate`}>{row.cidade ?? DASH}</td>
                  <td className={`${TD} text-[var(--voux-text-soft)] max-w-[140px] truncate`}>{row.consultor ?? DASH}</td>
                  <td className={`${TD} text-[var(--voux-text-soft)] max-w-[130px] truncate`}>{row.etapa ?? DASH}</td>
                  <td className={`${TD} max-w-[180px] truncate`} title={row.produto ?? undefined}>{row.produto ?? "Sem produto vinculado"}</td>
                  <td className={`${TD} text-[var(--voux-text-soft)] max-w-[240px] truncate`} title={row.observacaoNegocio ?? undefined}>{row.observacaoNegocio ?? DASH}</td>
                  <td className={`${TD} text-right tabular-nums whitespace-nowrap ${isStale ? "text-[var(--voux-danger)]" : ""}`}>
                    {brl(row.valor)}
                  </td>
                  <td className={`${TD} text-[var(--voux-text-soft)] max-w-[120px] truncate`}>{row.ultimaAcao ?? DASH}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums`}>{formatDateTimeBR(row.dataUltimaAcao) ?? DASH}</td>
                  <td className={`${TD} whitespace-nowrap tabular-nums text-[var(--voux-text-soft)]`}>{formatDateTimeBR(row.dataCadastroNegocio) ?? DASH}</td>
                  <td className={`${TD} text-right tabular-nums whitespace-nowrap ${isStale ? "text-[var(--voux-danger)] font-semibold" : ""}`}>
                    {row.diasParado}
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={12} className="py-6 text-center text-[var(--voux-text-muted)]">
                  {search.trim() ? "Nenhum negocio corresponde a busca." : "Nenhum negocio nesta pagina."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BiTableCard>
  );
}
