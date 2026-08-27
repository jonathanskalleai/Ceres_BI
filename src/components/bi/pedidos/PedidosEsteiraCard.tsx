import { useState, useMemo } from "react";
import {
  FileClock,
  FilePenLine,
  Layers,
  ChevronRight,
  Search,
} from "lucide-react";
import { formatBRL, formatDateBR } from "@/lib/dateUtils";
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
import type { PedidosEsteiraData, PedidoEsteiraItem } from "@/services/bi/pedidosEsteiraService";

interface Props {
  data?: PedidosEsteiraData;
  isLoading?: boolean;
  variant?: "full" | "compact" | "strip";
  className?: string;
  ano?: number | null;
  periodoLabel?: string;
}

export function PedidosEsteiraCard({
  data,
  isLoading,
  variant = "strip",
  className,
  ano,
  periodoLabel,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filterSituacao, setFilterSituacao] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const aguardandoAprovacao = data?.aguardandoAprovacao ?? { qtd: 0, valor: 0 };
  const aguardandoAssinatura = data?.aguardandoAssinatura ?? { qtd: 0, valor: 0 };
  const totalEsteira = data?.totalEsteira ?? { qtd: 0, valor: 0 };
  const pedidos = data?.pedidos ?? [];

  const handleOpenModal = (situacao?: string) => {
    setFilterSituacao(situacao ?? null);
    setSearchTerm("");
    setModalOpen(true);
  };

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      if (filterSituacao && p.situacao !== filterSituacao) return false;
      if (!searchTerm) return true;
      const term = searchTerm.toLowerCase();
      return (
        p.numeroPedido?.toLowerCase().includes(term) ||
        p.cliente?.toLowerCase().includes(term) ||
        p.consultor?.toLowerCase().includes(term) ||
        p.cidade?.toLowerCase().includes(term)
      );
    });
  }, [pedidos, filterSituacao, searchTerm]);

  // =========================================================================
  // VARIANTE: STRIP (Ribbon horizontal de 3 cards — Aprovação, Assinatura, Total)
  // =========================================================================
  if (variant === "strip") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            <span className="text-[11px] font-bold uppercase tracking-wider font-mono text-muted-foreground">
              Esteira de Fechamento de Pedidos
            </span>
          </div>
          {periodoLabel && (
            <span className="text-[10px] font-mono font-medium px-2.5 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20">
              {periodoLabel}
            </span>
          )}
        </div>

        <div className={cn("grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4", className)}>
          {/* Card 1: Aguardando Aprovação */}
          <div
            onClick={() => handleOpenModal("Aguardando Aprovação")}
            className="group relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:border-amber-500/50 hover:shadow-md"
            style={{
              background: "var(--voux-card-from)",
              borderColor: "var(--voux-card-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-muted-foreground">
                  Aguardando Aprovação
                </span>
              </div>
              <FileClock className="h-4 w-4 text-amber-500 transition-transform group-hover:scale-110" />
            </div>

            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[22px] md:text-[24px] font-bold font-mono text-amber-600 dark:text-amber-400">
                    {aguardandoAprovacao.qtd} <span className="text-[12px] font-medium text-muted-foreground">{aguardandoAprovacao.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(aguardandoAprovacao.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span>Em análise de aprovação</span>
                  <span className="text-amber-600 dark:text-amber-400 group-hover:underline inline-flex items-center">
                    Ver pedidos <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Aguardando Assinatura do Cliente */}
          <div
            onClick={() => handleOpenModal("Aguardando Assinatura Cliente")}
            className="group relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:border-sky-500/50 hover:shadow-md"
            style={{
              background: "var(--voux-card-from)",
              borderColor: "var(--voux-card-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-muted-foreground">
                  Aguardando Assinatura
                </span>
              </div>
              <FilePenLine className="h-4 w-4 text-sky-500 transition-transform group-hover:scale-110" />
            </div>

            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[22px] md:text-[24px] font-bold font-mono text-sky-600 dark:text-sky-400">
                    {aguardandoAssinatura.qtd} <span className="text-[12px] font-medium text-muted-foreground">{aguardandoAssinatura.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(aguardandoAssinatura.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span>Assinatura do cliente</span>
                  <span className="text-sky-600 dark:text-sky-400 group-hover:underline inline-flex items-center">
                    Ver pedidos <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Total da Esteira de Fechamento (Soma dos 2) */}
          <div
            onClick={() => handleOpenModal()}
            className="group relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:border-purple-500/50 hover:shadow-md"
            style={{
              background: "var(--voux-card-from)",
              borderColor: "var(--voux-card-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <Layers className="h-3.5 w-3.5 text-purple-500" />
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-muted-foreground">
                  Total Esteira de Fechamento
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-mono font-bold text-purple-600 dark:text-purple-400 border border-purple-500/20">
                Soma dos 2
              </span>
            </div>

            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[22px] md:text-[24px] font-bold font-mono text-purple-700 dark:text-purple-300">
                    {totalEsteira.qtd} <span className="text-[12px] font-medium text-muted-foreground">{totalEsteira.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(totalEsteira.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span>Aprovação ({aguardandoAprovacao.qtd}) + Assinatura ({aguardandoAssinatura.qtd})</span>
                  <span className="text-purple-600 dark:text-purple-400 group-hover:underline inline-flex items-center">
                    Ver todos <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Detalhamento dos Pedidos da Esteira */}
        <EsteiraDetailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          pedidos={filteredPedidos}
          filterSituacao={filterSituacao}
          setFilterSituacao={setFilterSituacao}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          totalValor={filteredPedidos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)}
        />
      </div>
    );
  }

  // =========================================================================
  // VARIANTE: COMPACT (Para uso em blocos menores caso necessário)
  // =========================================================================
  if (variant === "compact") {
    return (
      <>
        <div
          className={cn(
            "rounded-xl border p-3 bg-black/[0.015] dark:bg-white/[0.015] transition-all duration-200",
            className
          )}
          style={{ borderColor: "var(--voux-card-border)" }}
        >
          <div className="flex items-center justify-between text-[11px] mb-2 pb-1.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <span className="font-semibold text-muted-foreground font-mono flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-500" />
              Esteira de Fechamento
            </span>
            <button
              onClick={() => handleOpenModal()}
              className="text-[10px] font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center font-bold"
            >
              {totalEsteira.qtd} pedidos · {formatBRL(totalEsteira.valor)}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            <div
              onClick={() => handleOpenModal("Aguardando Aprovação")}
              className="cursor-pointer rounded-lg border p-2 bg-amber-500/[0.04] hover:bg-amber-500/[0.08] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <span className="text-[10px] text-muted-foreground block mb-0.5">Aguard. Aprov.</span>
              <p className="font-bold text-[14px] text-amber-600 dark:text-amber-400 leading-tight">
                {aguardandoAprovacao.qtd} ped.
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                {formatBRL(aguardandoAprovacao.valor)}
              </p>
            </div>

            <div
              onClick={() => handleOpenModal("Aguardando Assinatura Cliente")}
              className="cursor-pointer rounded-lg border p-2 bg-sky-500/[0.04] hover:bg-sky-500/[0.08] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <span className="text-[10px] text-muted-foreground block mb-0.5">Aguard. Assin.</span>
              <p className="font-bold text-[14px] text-sky-600 dark:text-sky-400 leading-tight">
                {aguardandoAssinatura.qtd} ped.
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                {formatBRL(aguardandoAssinatura.valor)}
              </p>
            </div>
          </div>
        </div>

        <EsteiraDetailModal
          open={modalOpen}
          onOpenChange={setModalOpen}
          pedidos={filteredPedidos}
          filterSituacao={filterSituacao}
          setFilterSituacao={setFilterSituacao}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          totalValor={filteredPedidos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)}
        />
      </>
    );
  }

  // =========================================================================
  // VARIANTE: FULL (Card independente completo)
  // =========================================================================
  return (
    <>
      <div
        className={cn(
          "rounded-2xl border p-5 transition-all duration-200",
          className
        )}
        style={{
          background: "var(--surface-raised)",
          borderColor: "var(--voux-card-border)",
          boxShadow: "var(--voux-card-shadow)",
        }}
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-purple-500" />
            <h3
              className="text-[12px] font-semibold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              Esteira de Fechamento {ano ? `· ${ano}` : ""}
            </h3>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="text-[11px] font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
          >
            Ver todos ({totalEsteira.qtd}) <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div
            onClick={() => handleOpenModal("Aguardando Aprovação")}
            className="cursor-pointer rounded-xl border p-3 bg-amber-500/[0.03] hover:border-amber-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Aguardando Aprovação
            </span>
            <p className="text-[20px] font-bold font-mono text-amber-600 dark:text-amber-400">
              {aguardandoAprovacao.qtd} <span className="text-[12px] font-normal text-muted-foreground">{aguardandoAprovacao.qtd === 1 ? "pedido" : "pedidos"}</span>
            </p>
            <span className="text-[12px] font-mono font-semibold text-foreground">
              {formatBRL(aguardandoAprovacao.valor)}
            </span>
          </div>

          <div
            onClick={() => handleOpenModal("Aguardando Assinatura Cliente")}
            className="cursor-pointer rounded-xl border p-3 bg-sky-500/[0.03] hover:border-sky-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Aguardando Assinatura
            </span>
            <p className="text-[20px] font-bold font-mono text-sky-600 dark:text-sky-400">
              {aguardandoAssinatura.qtd} <span className="text-[12px] font-normal text-muted-foreground">{aguardandoAssinatura.qtd === 1 ? "pedido" : "pedidos"}</span>
            </p>
            <span className="text-[12px] font-mono font-semibold text-foreground">
              {formatBRL(aguardandoAssinatura.valor)}
            </span>
          </div>

          <div
            onClick={() => handleOpenModal()}
            className="cursor-pointer rounded-xl border p-3 bg-purple-500/[0.03] hover:border-purple-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Total Esteira de Fechamento
            </span>
            <p className="text-[20px] font-bold font-mono text-purple-600 dark:text-purple-400">
              {totalEsteira.qtd} <span className="text-[12px] font-normal text-muted-foreground">{totalEsteira.qtd === 1 ? "pedido" : "pedidos"}</span>
            </p>
            <span className="text-[12px] font-mono font-semibold text-foreground">
              {formatBRL(totalEsteira.valor)}
            </span>
          </div>
        </div>
      </div>

      <EsteiraDetailModal
        open={modalOpen}
        onOpenChange={setModalOpen}
        pedidos={filteredPedidos}
        filterSituacao={filterSituacao}
        setFilterSituacao={setFilterSituacao}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        totalValor={filteredPedidos.reduce((acc, p) => acc + (Number(p.valor) || 0), 0)}
      />
    </>
  );
}

// =========================================================================
// SUB-COMPONENTE: MODAL COM LISTAGEM NOMINAL DOS PEDIDOS DA ESTEIRA
// =========================================================================
interface ModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidos: PedidoEsteiraItem[];
  filterSituacao: string | null;
  setFilterSituacao: (situacao: string | null) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  totalValor: number;
}

function EsteiraDetailModal({
  open,
  onOpenChange,
  pedidos,
  filterSituacao,
  setFilterSituacao,
  searchTerm,
  setSearchTerm,
  totalValor,
}: ModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden bg-background">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" />
                Detalhamento dos Pedidos da Esteira
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Pedidos em tramitação de aprovação e assinatura no período selecionado
              </DialogDescription>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-muted-foreground block">
                Total ({pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"})
              </span>
              <span className="text-base font-bold font-mono text-foreground">
                {formatBRL(totalValor)}
              </span>
            </div>
          </div>

          {/* Filtros e Busca */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-3">
            <div className="relative w-full sm:flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente, pedido, consultor ou cidade..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 text-xs font-mono h-9"
              />
            </div>

            {/* Badges de Filtro por Situação */}
            <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
              <button
                type="button"
                onClick={() => setFilterSituacao(null)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap",
                  filterSituacao === null
                    ? "bg-purple-600 text-white shadow-sm"
                    : "bg-black/5 dark:bg-white/5 text-muted-foreground hover:bg-black/10"
                )}
              >
                Todos
              </button>
              <button
                type="button"
                onClick={() => setFilterSituacao("Aguardando Aprovação")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap",
                  filterSituacao === "Aguardando Aprovação"
                    ? "bg-amber-600 text-white shadow-sm"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                )}
              >
                Aguard. Aprovação
              </button>
              <button
                type="button"
                onClick={() => setFilterSituacao("Aguardando Assinatura Cliente")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap",
                  filterSituacao === "Aguardando Assinatura Cliente"
                    ? "bg-sky-600 text-white shadow-sm"
                    : "bg-sky-500/10 text-sky-600 dark:text-sky-400 hover:bg-sky-500/20"
                )}
              >
                Aguard. Assinatura
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* Tabela de Pedidos da Esteira */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
          {pedidos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground font-mono text-xs">
              Nenhum pedido em tramitação encontrado com os filtros selecionados.
            </div>
          ) : (
            <div className="rounded-lg border overflow-hidden" style={{ borderColor: "var(--voux-card-border)" }}>
              <table className="w-full text-left text-xs font-mono">
                <thead className="bg-muted/50 border-b text-[11px] uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2.5">Pedido</th>
                    <th className="px-3 py-2.5">Cliente</th>
                    <th className="px-3 py-2.5">Consultor</th>
                    <th className="px-3 py-2.5">Cidade</th>
                    <th className="px-3 py-2.5">Situação</th>
                    <th className="px-3 py-2.5 text-right">Valor</th>
                    <th className="px-3 py-2.5 text-right">Data</th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--voux-card-border)" }}>
                  {pedidos.map((p, idx) => {
                    const isAprov = p.situacao === "Aguardando Aprovação";
                    return (
                      <tr
                        key={`${p.codigoInterno}-${idx}`}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-3 py-2 font-bold text-foreground whitespace-nowrap">
                          #{p.numeroPedido || p.codigoInterno.slice(-5)}
                        </td>
                        <td className="px-3 py-2 font-medium max-w-[220px] truncate" title={p.cliente}>
                          {p.cliente}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[160px] truncate" title={p.consultor}>
                          {p.consultor}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {p.cidade}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              isAprov
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isAprov ? "bg-amber-500" : "bg-sky-500"
                              )}
                            />
                            {p.situacao}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right font-bold text-foreground whitespace-nowrap tabular-nums">
                          {formatBRL(p.valor)}
                        </td>
                        <td className="px-3 py-2 text-right text-muted-foreground whitespace-nowrap">
                          {p.data ? formatDateBR(p.data.slice(0, 10)) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
