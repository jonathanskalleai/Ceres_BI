import { useState, useMemo } from "react";
import {
  FileClock,
  FileCheck2,
  FilePenLine,
  Layers,
  ChevronRight,
  Search,
  ExternalLink,
  Info,
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

  const aprovados = data?.aprovados ?? { qtd: 0, valor: 0 };
  const aguardandoAprovacao = data?.aguardandoAprovacao ?? { qtd: 0, valor: 0 };
  const aguardandoAssinatura = data?.aguardandoAssinatura ?? { qtd: 0, valor: 0, qtdGanho: 0, valorGanho: 0 };
  const totalEsteira = data?.totalEsteira ?? { qtd: 0, valor: 0 };
  const totalConsolidado = data?.totalConsolidado ?? { qtd: 0, valor: 0 };
  const totalAlinhadoPlanilha = data?.totalAlinhadoPlanilha ?? { qtd: 0, valor: 0 };
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
  // VARIANTE: STRIP (Ribbon horizontal de 4 cards para Desempenho / Ações)
  // =========================================================================
  if (variant === "strip") {
    return (
      <>
        <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4", className)}>
          {/* Card 1: Aprovados (Ganhos Oficiais) */}
          <div
            onClick={() => handleOpenModal("Aprovado")}
            className="group relative cursor-pointer rounded-2xl border p-4 transition-all duration-200 hover:border-emerald-500/50 hover:shadow-md"
            style={{
              background: "var(--voux-card-from)",
              borderColor: "var(--voux-card-border)",
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-muted-foreground">
                  Pedidos Aprovados
                </span>
              </div>
              <FileCheck2 className="h-4 w-4 text-emerald-500 transition-transform group-hover:scale-110" />
            </div>

            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[20px] md:text-[22px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
                    {aprovados.qtd} <span className="text-[12px] font-medium text-muted-foreground">{aprovados.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(aprovados.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span>Faturamento ganho oficial</span>
                  <span className="text-emerald-600 dark:text-emerald-400 group-hover:underline inline-flex items-center">
                    Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Aguardando Aprovação */}
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
                  <p className="text-[20px] md:text-[22px] font-bold font-mono text-amber-600 dark:text-amber-400">
                    {aguardandoAprovacao.qtd} <span className="text-[12px] font-medium text-muted-foreground">{aguardandoAprovacao.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(aguardandoAprovacao.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span>Em análise interna</span>
                  <span className="text-amber-600 dark:text-amber-400 group-hover:underline inline-flex items-center">
                    Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 3: Aguardando Assinatura do Cliente */}
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
                  <p className="text-[20px] md:text-[22px] font-bold font-mono text-sky-600 dark:text-sky-400">
                    {aguardandoAssinatura.qtd} <span className="text-[12px] font-medium text-muted-foreground">{aguardandoAssinatura.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(aguardandoAssinatura.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-sky-600 dark:text-sky-400 font-semibold truncate" title="5 pedidos com negócio ganho no CRM">
                    {aguardandoAssinatura.qtdGanho} ganhos ({formatBRL(aguardandoAssinatura.valorGanho)})
                  </span>
                  <span className="text-sky-600 dark:text-sky-400 group-hover:underline inline-flex items-center shrink-0">
                    Ver <ChevronRight className="h-3 w-3 ml-0.5" />
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Card 4: Total Esteira em Tramitação (Totalizador) */}
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
              <span className="inline-flex items-center rounded-full bg-purple-500/10 px-2 py-0.5 text-[9px] font-mono font-medium text-purple-600 dark:text-purple-400">
                Pipeline
              </span>
            </div>

            {isLoading ? (
              <Skeleton className="h-10 w-32 bg-[var(--voux-skeleton)]" />
            ) : (
              <div>
                <div className="flex items-baseline justify-between">
                  <p className="text-[20px] md:text-[22px] font-bold font-mono text-purple-700 dark:text-purple-300">
                    {totalEsteira.qtd} <span className="text-[12px] font-medium text-muted-foreground">{totalEsteira.qtd === 1 ? "pedido" : "pedidos"}</span>
                  </p>
                </div>
                <p className="font-mono font-semibold text-[13px] text-foreground mt-0.5">
                  {formatBRL(totalEsteira.valor)}
                </p>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1 font-mono pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span>Total esteira fechamento</span>
                  <span className="text-purple-600 dark:text-purple-400 group-hover:underline inline-flex items-center">
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
          <div className="flex items-center justify-between text-[11px] mb-2.5 pb-1.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <span className="font-semibold text-muted-foreground font-mono flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5 text-purple-500" />
              Esteira de Fechamento de Pedidos {ano ? `(${ano})` : ""}
            </span>
            <button
              onClick={() => handleOpenModal()}
              className="text-[10px] font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center font-bold"
            >
              {totalEsteira.qtd} em tramitação · {formatBRL(totalEsteira.valor)}
              <ChevronRight className="h-3 w-3 ml-0.5" />
            </button>
          </div>

          {/* Grid de 3 Cards: Aprovados | Aguardando Aprovação | Aguardando Assinatura */}
          <div className="grid grid-cols-3 gap-2 text-[11px] font-mono mb-2">
            {/* 1. Aprovados */}
            <div
              onClick={() => handleOpenModal("Aprovado")}
              className="cursor-pointer rounded-lg border p-2 bg-emerald-500/[0.04] hover:bg-emerald-500/[0.08] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                  Aprovados
                </span>
              </div>
              <p className="font-bold text-[14px] text-emerald-600 dark:text-emerald-400 leading-tight">
                {aprovados.qtd} <span className="text-[10px] font-normal text-muted-foreground">ped.</span>
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                {formatBRL(aprovados.valor)}
              </p>
            </div>

            {/* 2. Aguardando Aprovação */}
            <div
              onClick={() => handleOpenModal("Aguardando Aprovação")}
              className="cursor-pointer rounded-lg border p-2 bg-amber-500/[0.04] hover:bg-amber-500/[0.08] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  Aguard. Aprov.
                </span>
              </div>
              <p className="font-bold text-[14px] text-amber-600 dark:text-amber-400 leading-tight">
                {aguardandoAprovacao.qtd} <span className="text-[10px] font-normal text-muted-foreground">ped.</span>
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                {formatBRL(aguardandoAprovacao.valor)}
              </p>
            </div>

            {/* 3. Aguardando Assinatura */}
            <div
              onClick={() => handleOpenModal("Aguardando Assinatura Cliente")}
              className="cursor-pointer rounded-lg border p-2 bg-sky-500/[0.04] hover:bg-sky-500/[0.08] transition-colors"
              style={{ borderColor: "var(--voux-card-border)" }}
            >
              <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                  Aguard. Assin.
                </span>
              </div>
              <p className="font-bold text-[14px] text-sky-600 dark:text-sky-400 leading-tight">
                {aguardandoAssinatura.qtd} <span className="text-[10px] font-normal text-muted-foreground">ped.</span>
              </p>
              <p className="text-[10px] font-mono text-muted-foreground truncate mt-0.5">
                {formatBRL(aguardandoAssinatura.valor)}
              </p>
            </div>
          </div>

          {/* Rodapé Didático com Alinhamento da Planilha */}
          <div className="flex items-center justify-between text-[10px] font-mono pt-1.5 border-t text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
            <span className="flex items-center gap-1">
              <Info className="h-3 w-3 text-sky-500" />
              Alinhado Planilha (Aprovados + 5 Ganhos Assin.):
            </span>
            <strong className="text-foreground font-bold">
              {totalAlinhadoPlanilha.qtd} ped. · {formatBRL(totalAlinhadoPlanilha.valor)}
            </strong>
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
  // VARIANTE: FULL (Card completo)
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
              Esteira de Fechamento de Pedidos {ano ? `· ${ano}` : ""}
            </h3>
          </div>
          <button
            onClick={() => handleOpenModal()}
            className="text-[11px] font-mono text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center"
          >
            Ver todos ({totalConsolidado.qtd}) <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
          {/* Aprovados */}
          <div
            onClick={() => handleOpenModal("Aprovado")}
            className="cursor-pointer rounded-xl border p-3 bg-emerald-500/[0.03] hover:border-emerald-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Aprovados (Ganho)
            </span>
            <p className="text-[20px] font-bold font-mono text-emerald-600 dark:text-emerald-400">
              {aprovados.qtd} <span className="text-[12px] font-normal text-muted-foreground">{aprovados.qtd === 1 ? "pedido" : "pedidos"}</span>
            </p>
            <span className="text-[12px] font-mono font-semibold text-foreground">
              {formatBRL(aprovados.valor)}
            </span>
          </div>

          {/* Aguardando Aprovação */}
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

          {/* Aguardando Assinatura */}
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

          {/* Total Esteira */}
          <div
            onClick={() => handleOpenModal()}
            className="cursor-pointer rounded-xl border p-3 bg-purple-500/[0.03] hover:border-purple-500/50 transition-all"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <span className="text-[10px] font-mono uppercase text-muted-foreground block mb-1">
              Total em Tramitação
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
// SUB-COMPONENTE: MODAL COM LISTAGEM NOMINAL DOS PEDIDOS
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
                Lista nominal de pedidos com status de aprovação, assinatura e faturamento ganho
              </DialogDescription>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-mono text-muted-foreground block">
                Total Exibido ({pedidos.length} {pedidos.length === 1 ? "pedido" : "pedidos"})
              </span>
              <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">
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
                onClick={() => setFilterSituacao("Aprovado")}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap",
                  filterSituacao === "Aprovado"
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20"
                )}
              >
                Aprovados
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

        {/* Tabela de Pedidos */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[55vh]">
          {pedidos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground font-mono text-xs">
              Nenhum pedido encontrado com os filtros selecionados.
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
                    const isAprovado = p.situacao === "Aprovado";
                    const isAprov = p.situacao === "Aguardando Aprovação";
                    return (
                      <tr
                        key={`${p.codigoInterno}-${idx}`}
                        className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors"
                      >
                        <td className="px-3 py-2 font-bold text-foreground whitespace-nowrap">
                          #{p.numeroPedido || p.codigoInterno.slice(-5)}
                        </td>
                        <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={p.cliente}>
                          {p.cliente}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground max-w-[150px] truncate" title={p.consultor}>
                          {p.consultor}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">
                          {p.cidade}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border",
                              isAprovado
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : isAprov
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20"
                            )}
                          >
                            <span
                              className={cn(
                                "h-1.5 w-1.5 rounded-full",
                                isAprovado ? "bg-emerald-500" : isAprov ? "bg-amber-500" : "bg-sky-500"
                              )}
                            />
                            {p.situacao}
                            {p.conclusaoNegocio === "Ganho" && !isAprovado && (
                              <span className="ml-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400" title="Negócio Ganho no CRM">
                                (Ganho CRM)
                              </span>
                            )}
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
