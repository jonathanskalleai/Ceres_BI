import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { BiTableCard } from "@/components/bi/BiTableCard";
import { PaginationControls } from "@/components/bi/PaginationControls";
import type { PedidoDetalheRow } from "@/services/bi/acoesPedidosGanhosService";
import { PEDIDOS_GANHOS_PAGE_SIZE } from "@/hooks/bi/usePedidosGanhosRpc";

const TH = "text-left py-2 px-2 font-medium text-[var(--voux-text-muted)]";
const TD = "py-2 px-2 text-[var(--voux-text-primary)]";
const DASH = "—";

const brl = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 2 });

function matches(row: PedidoDetalheRow, term: string): boolean {
  return [row.cliente, row.cidade, row.consultor, row.pedidoCodigo]
    .some((v) => (v ?? "").toLowerCase().includes(term));
}

interface Props {
  rows: PedidoDetalheRow[];
  total: number;
  page: number;
  onPageChange: (page: number) => void;
  loading?: boolean;
  error?: Error | null;
}

/**
 * Tabela de pedidos aprovados — Story 4-A drill-down.
 * Colunas: Nº Pedido | Cliente | Cidade | Consultor | Data Aprovacao | Valor.
 * Ordenacao: dataAprovacao DESC (veem da RPC).
 * Badge: "Mostrando pedidos aprovados — fontes: crm_pedidos + crm_negocios".
 */
export function AcoesPedidosTable({ rows, total, page, onPageChange, loading, error }: Props) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) => matches(r, term));
  }, [rows, search]);

  const totalPages = Math.max(1, Math.ceil(total / PEDIDOS_GANHOS_PAGE_SIZE));
  const rangeStart = total === 0 ? 0 : (page - 1) * PEDIDOS_GANHOS_PAGE_SIZE + 1;
  const rangeEnd = Math.min(page * PEDIDOS_GANHOS_PAGE_SIZE, total);
  const rangeLabel = total > 0
    ? `Mostrando ${rangeStart.toLocaleString("pt-BR")}–${rangeEnd.toLocaleString("pt-BR")} de ${total.toLocaleString("pt-BR")}`
    : undefined;

  const counter = search.trim()
    ? `${filtered.length.toLocaleString("pt-BR")} encontrados na pagina`
    : `${total.toLocaleString("pt-BR")} pedidos`;

  const searchBox = (
    <div className="relative">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--voux-text-muted)]" aria-hidden="true" />
      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Buscar pedido, cliente..."
        aria-label="Buscar nos pedidos aprovados"
        className="h-8 w-full sm:w-64 rounded-md border border-[var(--voux-card-border)] bg-transparent pl-8 pr-2 text-xs text-[var(--voux-text-primary)] placeholder:text-[var(--voux-text-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--voux-champagne-400)]"
      />
    </div>
  );

  const badge = (
    <p className="text-[11px] italic text-[var(--voux-text-muted)]">
      Mostrando pedidos aprovados — fontes: crm_pedidos + crm_negocios
    </p>
  );

  return (
    <BiTableCard
      title={`Pedidos Aprovados · ${counter}`}
      actions={searchBox}
      loading={loading}
      error={error}
      isEmpty={rows.length === 0 && total === 0}
      emptyMessage="Nenhum pedido aprovado no periodo selecionado."
      skeletonRows={8}
      footer={
        <>
          {badge}
          <PaginationControls page={page} totalPages={totalPages} onPageChange={onPageChange} rangeLabel={rangeLabel} />
        </>
      }
    >
      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 bg-[var(--voux-card-from)] z-10">
            <tr>
              <th className={TH}>Nº Pedido</th>
              <th className={TH}>Cliente</th>
              <th className={TH}>Cidade</th>
              <th className={TH}>Consultor</th>
              <th className={TH}>Data Aprovacao</th>
              <th className={`${TH} text-right`}>Valor</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr key={`${row.pedidoCodigo}-${i}`} className="border-t border-[var(--voux-card-border)]/30">
                <td className={`${TD} tabular-nums font-mono`}>{row.pedidoCodigo}</td>
                <td className={`${TD} max-w-[180px] truncate`}>{row.cliente ?? DASH}</td>
                <td className={`${TD} text-[var(--voux-text-soft)] max-w-[120px] truncate`}>{row.cidade ?? DASH}</td>
                <td className={`${TD} text-[var(--voux-text-soft)] max-w-[150px] truncate`}>{row.consultor ?? DASH}</td>
                <td className={`${TD} whitespace-nowrap tabular-nums`}>{row.dataAprovacao}</td>
                <td className={`${TD} text-right tabular-nums whitespace-nowrap`}>{brl(row.valorPedido)}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="py-6 text-center text-[var(--voux-text-muted)]">
                  {search.trim() ? "Nenhum pedido corresponde a busca." : "Nenhum pedido nesta pagina."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </BiTableCard>
  );
}
