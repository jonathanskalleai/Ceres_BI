import { useState, useMemo } from "react";
import { CheckCircle2, Search, ShoppingCart, X } from "lucide-react";
import { formatBRL, formatDateTimeBR } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { usePedidosGanhosRpc } from "@/hooks/bi/usePedidosGanhosRpc";
import type { PedidoDetalheRow } from "@/services/bi/acoesPedidosGanhosService";

interface PedidosGanhosModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  from?: string | null;
  to?: string | null;
  vendedor?: string | null;
  cidade?: string | null;
  periodoLabel?: string;
}

export function PedidosGanhosModal({
  open,
  onOpenChange,
  from,
  to,
  vendedor,
  cidade,
  periodoLabel,
}: PedidosGanhosModalProps) {
  const [searchTerm, setSearchTerm] = useState("");

  const { data, isLoading, error } = usePedidosGanhosRpc({
    from: from ?? undefined,
    to: to ?? undefined,
    vendedor: vendedor ?? undefined,
    cidade: cidade ?? undefined,
    page: 1,
    enabled: open,
  });

  const rows = data?.rows ?? [];
  const totalCount = data?.total ?? 0;

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r: PedidoDetalheRow) =>
      [
        r.pedidoCodigo,
        r.cliente,
        r.cidade,
        r.consultor,
        r.produto,
        r.observacaoNegocio,
      ].some((v) => (v ?? "").toLowerCase().includes(term))
    );
  }, [rows, searchTerm]);

  const totalValor = useMemo(() => {
    return filtered.reduce((acc, p) => acc + (Number(p.valorPedido) || 0), 0);
  }, [filtered]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-[var(--surface-raised)] border border-[var(--voux-card-border)]">
        <DialogHeader className="p-6 pb-4 border-b border-[var(--voux-card-border)]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-[var(--voux-text-heading)]">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                Detalhamento dos Pedidos Ganhos
                {periodoLabel && (
                  <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20 ml-2">
                    {periodoLabel}
                  </span>
                )}
              </DialogTitle>
              <DialogDescription className="text-xs text-[var(--voux-text-muted)]">
                Listagem nominal e valores de cada pedido aprovado no período filtrado
              </DialogDescription>
            </div>

            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] font-mono text-[var(--voux-text-muted)] block">
                Total ({filtered.length} {filtered.length === 1 ? "pedido" : "pedidos"})
              </span>
              <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                {formatBRL(totalValor)}
              </span>
            </div>
          </div>

          {/* Barra de Busca */}
          <div className="flex items-center gap-3 pt-3">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-[var(--voux-text-muted)]" />
              <Input
                placeholder="Buscar por cliente, pedido, consultor, produto ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-xs font-mono h-9 bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm("")}
                  className="absolute right-2.5 top-2.5 text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </DialogHeader>

        {/* Conteúdo da Tabela */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
          {isLoading ? (
            <div className="space-y-2 p-2">
              <Skeleton className="h-8 w-full bg-[var(--voux-skeleton)]" />
              <Skeleton className="h-8 w-full bg-[var(--voux-skeleton)]" />
              <Skeleton className="h-8 w-full bg-[var(--voux-skeleton)]" />
              <Skeleton className="h-8 w-full bg-[var(--voux-skeleton)]" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-red-500 font-mono text-xs">
              Erro ao carregar detalhes dos pedidos: {error.message}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-[var(--voux-text-muted)] font-mono text-xs">
              {searchTerm.trim()
                ? "Nenhum pedido encontrado correspondente à busca."
                : "Nenhum pedido aprovado no período selecionado."}
            </div>
          ) : (
            <div
              className="rounded-lg border overflow-hidden"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-[var(--voux-card-from)] border-b border-[var(--voux-card-border)] text-[11px] uppercase tracking-wider text-[var(--voux-text-muted)] sticky top-0 z-10">
                  <tr>
                    <th className="px-3 py-2.5">Nº Pedido</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5">Consultor</th>
                    <th className="px-3 py-2.5">Cidade</th>
                    <th className="px-3 py-2.5">Produto(s)</th>
                    <th className="px-3 py-2.5">Obs. Negócio</th>
                    <th className="px-3 py-2.5 text-right">Data Aprov.</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--voux-card-border)]/40 bg-[var(--surface-raised)]">
                  {filtered.map((p, idx) => (
                    <tr
                      key={`${p.pedidoCodigo}-${idx}`}
                      className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                    >
                      <td className="px-3 py-2 font-bold text-[var(--voux-text-primary)] whitespace-nowrap">
                        #{p.pedidoCodigo}
                      </td>
                      <td
                        className="px-3 py-2 font-medium max-w-[180px] truncate text-[var(--voux-text-primary)]"
                        title={p.cliente}
                      >
                        {p.cliente || "—"}
                      </td>
                      <td
                        className="px-3 py-2 text-[var(--voux-text-muted)] max-w-[140px] truncate"
                        title={p.consultor}
                      >
                        {p.consultor || "—"}
                      </td>
                      <td className="px-3 py-2 text-[var(--voux-text-muted)] whitespace-nowrap">
                        {p.cidade || "—"}
                      </td>
                      <td
                        className="px-3 py-2 max-w-[180px] truncate text-[var(--voux-text-soft)]"
                        title={p.produto ?? undefined}
                      >
                        {p.produto || "Sem produto vinculado"}
                      </td>
                      <td
                        className="px-3 py-2 text-[var(--voux-text-muted)] max-w-[200px] truncate"
                        title={p.observacaoNegocio ?? undefined}
                      >
                        {p.observacaoNegocio || "—"}
                      </td>
                      <td className="px-3 py-2 text-right text-[var(--voux-text-muted)] whitespace-nowrap">
                        {p.dataAprovacao ? formatDateTimeBR(p.dataAprovacao) : "—"}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-400 whitespace-nowrap tabular-nums">
                        {formatBRL(p.valorPedido ?? 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
