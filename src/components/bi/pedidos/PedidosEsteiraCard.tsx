import { useState } from "react";
import {
  FileClock,
  FileCheck2,
  FilePenLine,
  Layers,
  ChevronRight,
  Search,
  ExternalLink,
} from "lucide-react";
import { formatBRL } from "@/lib/dateUtils";
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
}

export function PedidosEsteiraCard({
  data,
  isLoading,
  variant = "full",
  className,
  ano,
}: Props) {
  const [modalOpen, setModalOpen] = useState(false);
  const [filterSituacao, setFilterSituacao] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const aguardandoAprovacao = data?.aguardandoAprovacao ?? { qtd: 0, valor: 0 };
  const aguardandoAssinatura = data?.aguardandoAssinatura ?? { qtd: 0, valor: 0, qtdGanho: 0, valorGanho: 0 };
  const totalEsteira = data?.totalEsteira ?? { qtd: 0, valor: 0 };
  const pedidos = data?.pedidos ?? [];

  const handleOpenModal = (situacao?: string) => {
    setFilterSituacao(situacao ?? null);
    setSearchTerm("");
    setModalOpen(true);
  };

  const filteredPedidos = pedidos.filter((p) => {
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

  // =========================================================================
  // VARIANTE: STRIP (Ribbon horizontal para KPIs de Desempenho de Vendas / Ações)
  // =========================================================================
  if (variant === "strip") {
    return (
      <>
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
              <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <p className="text-[18px] md:text-[20px] font-bold font-mono text-foreground">
                  {formatBRL(aguardandoAprovacao.valor)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5 font-mono">
                  <span>{aguardandoAprovacao.qtd} {aguardandoAprovacao.qtd === 1 ? "pedido" : "pedidos"}</span>
                  <span className="text-[10px] text-amber-600 dark:text-amber-400 group-hover:underline inline-flex items-center">
                    Ver detalhes <ChevronRight className="h-3 w-3 ml-0.5" />
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
              <Skeleton className="h-7 w-28 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <p className="text-[18px] md:text-[20px] font-bold font-mono text-foreground">
                  {formatBRL(aguardandoAssinatura.valor)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5 font-mono">
                  <span>{aguardandoAssinatura.qtd} {aguardandoAssinatura.qtd === 1 ? "pedido" : "pedidos"}</span>
                  <span className="text-[10px] text-sky-600 dark:text-sky-400 group-hover:underline inline-flex items-center">
                    Ver detalhes <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Total Esteira Pendente (Totalizador) */}
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
                  Total em Tramitação
                </span>
              </div>
              <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-mono font-medium text-purple-600 dark:text-purple-400">
                Pipeline Esteira
              </span>
            </div>

            {isLoading ? (
              <Skeleton className="h-7 w-28 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <p className="text-[18px] md:text-[20px] font-bold font-mono text-purple-700 dark:text-purple-300">
                  {formatBRL(totalEsteira.valor)}
                </p>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-0.5 font-mono">
                  <span>{totalEsteira.qtd} {totalEsteira.qtd === 1 ? "pedido" : "pedidos no pipeline"}</span>
                  <span className="text-[10px] text-purple-600 dark:text-purple-400 group-hover:underline inline-flex items-center">
                    Listar todos <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Modal de Detalhamento */}
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
  // VARIANTE: COMPACT (Ideal dentro do Resumo Executivo / Consultores)
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
          {/* Header */}
          <div className="flex items-center justify-between text-[11px] mb-2 pb-1.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <span className="font-semibold text-muted-foreground font-mono flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-500" />
              Esteira de Pedidos em Fechamento
            </span>
            <button
              onClick={() => handleOpenModal()}
              className="text-[10px] font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
            >
              {totalEsteira.qtd} em aberto · {formatBRL(totalEsteira.valor)}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </button>
          </div>

          {/* Sub-itens */}
          <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
            {/* Aguardando Aprovação */}
            <div
              onClick={() => handleOpenModal("Aguardando Aprovação")}
              className="cursor-pointer rounded-lg border p-2 bg-background/50 hover:bg-amber-500/[0.06] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Aguardando Aprov.
                </span>
                <span className="font-bold text-foreground">{aguardandoAprovacao.qtd} ped.</span>
              </div>
              <p className="font-bold text-[13px] text-amber-600 dark:text-amber-400">
                {formatBRL(aguardandoAprovacao.valor)}
              </p>
            </div>

            {/* Aguardando Assinatura */}
            <div
              onClick={() => handleOpenModal("Aguardando Assinatura Cliente")}
              className="cursor-pointer rounded-lg border p-2 bg-background/50 hover:bg-sky-500/[0.06] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Aguard. Assinatura
                </span>
                <span className="font-bold text-foreground">{aguardandoAssinatura.qtd} ped.</span>
              </div>
              <p className="font-bold text-[13px] text-sky-600 dark:text-sky-400">
                {formatBRL(aguardandoAssinatura.valor)}
              </p>
            </div>
          </div>
        </div>

        {/* Modal de Detalhamento */}
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
  // VARIANTE: FULL (Card completo independente)
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
              Esteira de Pedidos em Fechamento {ano ? `· ${ano}` : ""}
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
          {/* Aguardando Aprovação */}
          <div
            onClick={() => handleOpenModal("Aguardando Aprovação")}
            className="cursor-pointer rounded-xl border p-3 bg-black/[0.015] dark:bg-white/[0.015] hover:border-amber-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Aguardando Aprovação
            </span>
            <p className="text-[16px] font-bold font-mono text-amber-600 dark:text-amber-400">
              {formatBRL(aguardandoAprovacao.valor)}
            </p>
            <span className="text-[11px] font-mono text-muted-foreground">
              {aguardandoAprovacao.qtd} {aguardandoAprovacao.qtd === 1 ? "pedido" : "pedidos"}
            </span>
          </div>

          {/* Aguardando Assinatura */}
          <div
            onClick={() => handleOpenModal("Aguardando Assinatura Cliente")}
            className="cursor-pointer rounded-xl border p-3 bg-black/[0.015] dark:bg-white/[0.015] hover:border-sky-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Aguardando Assinatura
            </span>
            <p className="text-[16px] font-bold font-mono text-sky-600 dark:text-sky-400">
              {formatBRL(aguardandoAssinatura.valor)}
            </p>
            <span className="text-[11px] font-mono text-muted-foreground">
              {aguardandoAssinatura.qtd} {aguardandoAssinatura.qtd === 1 ? "pedido" : "pedidos"}
            </span>
          </div>

          {/* Totalizador */}
          <div
            onClick={() => handleOpenModal()}
            className="cursor-pointer rounded-xl border p-3 bg-purple-500/[0.04] border-purple-500/30 hover:border-purple-500 transition-all"
          >
            <span className="text-[10px] font-mono uppercase text-purple-600 dark:text-purple-400 font-semibold block mb-1">
              Total em Tramitação
            </span>
            <p className="text-[16px] font-bold font-mono text-purple-700 dark:text-purple-300">
              {formatBRL(totalEsteira.valor)}
            </p>
            <span className="text-[11px] font-mono text-muted-foreground">
              {totalEsteira.qtd} {totalEsteira.qtd === 1 ? "pedido" : "pedidos"}
            </span>
          </div>
        </div>
      </div>

      {/* Modal de Detalhamento */}
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

/**
 * Modal com a tabela completa dos pedidos na esteira (Aguardando Aprovação e Aguardando Assinatura).
 */
function EsteiraDetailModal({
  open,
  onOpenChange,
  pedidos,
  filterSituacao,
  setFilterSituacao,
  searchTerm,
  setSearchTerm,
  totalValor,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pedidos: PedidoEsteiraItem[];
  filterSituacao: string | null;
  setFilterSituacao: (sit: string | null) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
  totalValor: number;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
        <DialogHeader className="pb-3 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileClock className="h-5 w-5 text-purple-500" />
              <DialogTitle className="text-lg font-bold">
                Pedidos em Tramitação na Esteira
              </DialogTitle>
            </div>
            <div className="text-right">
              <span className="text-xs font-mono text-muted-foreground block">
                Total Filtrado ({pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"})
              </span>
              <span className="text-sm font-mono font-bold text-purple-600 dark:text-purple-400">
                {formatBRL(totalValor)}
              </span>
            </div>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Listagem completa dos pedidos com status Aguardando Aprovação e Aguardando Assinatura do Cliente.
          </DialogDescription>
        </DialogHeader>

        {/* Filtros e Busca */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-2 py-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto">
            <button
              onClick={() => setFilterSituacao(null)}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-colors",
                filterSituacao === null
                  ? "bg-purple-600 text-white font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterSituacao("Aguardando Aprovação")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-colors",
                filterSituacao === "Aguardando Aprovação"
                  ? "bg-amber-600 text-white font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              Aguardando Aprovação
            </button>
            <button
              onClick={() => setFilterSituacao("Aguardando Assinatura Cliente")}
              className={cn(
                "px-2.5 py-1 rounded-lg text-xs font-mono transition-colors",
                filterSituacao === "Aguardando Assinatura Cliente"
                  ? "bg-sky-600 text-white font-medium"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              Aguardando Assinatura
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente, pedido ou consultor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="h-8 pl-8 text-xs font-mono"
            />
          </div>
        </div>

        {/* Tabela de Pedidos */}
        <div className="flex-1 overflow-auto rounded-lg border" style={{ borderColor: "var(--voux-card-border)" }}>
          <table className="w-full text-left text-xs font-mono border-collapse">
            <thead className="sticky top-0 bg-muted/90 backdrop-blur-sm border-b" style={{ borderColor: "var(--voux-card-border)" }}>
              <tr>
                <th className="py-2 px-3 font-semibold text-muted-foreground">Pedido</th>
                <th className="py-2 px-3 font-semibold text-muted-foreground">Cliente</th>
                <th className="py-2 px-3 font-semibold text-muted-foreground">Consultor</th>
                <th className="py-2 px-3 font-semibold text-muted-foreground">Cidade</th>
                <th className="py-2 px-3 font-semibold text-muted-foreground text-right">Valor</th>
                <th className="py-2 px-3 font-semibold text-muted-foreground">Situação</th>
                <th className="py-2 px-3 font-semibold text-muted-foreground">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y" style={{ borderColor: "var(--voux-card-border)" }}>
              {pedidos.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-muted-foreground">
                    Nenhum pedido encontrado nesta esteira para o filtro selecionado.
                  </td>
                </tr>
              ) : (
                pedidos.map((p) => {
                  const isAprov = p.situacao === "Aguardando Aprovação";
                  const dataFmt = p.data ? new Date(p.data).toLocaleDateString("pt-BR") : "—";
                  return (
                    <tr key={p.codigoInterno} className="hover:bg-muted/40 transition-colors">
                      <td className="py-2.5 px-3 font-bold text-foreground">
                        #{p.numeroPedido || p.codigoInterno}
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate" title={p.cliente}>
                        {p.cliente || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-[140px] truncate" title={p.consultor}>
                        {p.consultor || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground max-w-[120px] truncate" title={p.cidade}>
                        {p.cidade || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right font-bold tabular-nums text-foreground">
                        {formatBRL(p.valor)}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border",
                            isAprov
                              ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30"
                              : "bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30"
                          )}
                        >
                          {p.situacao}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-muted-foreground">
                        {dataFmt}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </DialogContent>
    </Dialog>
  );
}
