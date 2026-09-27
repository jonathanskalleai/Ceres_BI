import type { DateRange } from "react-day-picker";
import { ChevronRight, DollarSign, ShoppingCart, TrendingUp, Trophy, Award, XCircle } from "lucide-react";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { PedidosEsteiraCard } from "@/components/bi/pedidos/PedidosEsteiraCard";
import { DesempenhoDetalheListas } from "@/components/bi/desempenho/DesempenhoDetalheListas";
import { DesempenhoDonutCard } from "@/components/bi/desempenho/DesempenhoDonutCard";
import { DesempenhoDualLineChart } from "@/components/bi/desempenho/DesempenhoDualLineChart";
import { DesempenhoTableCard, type DesempenhoTableSummary } from "@/components/bi/desempenho/DesempenhoTableCard";
import { FormattedCurrency } from "@/components/bi/desempenho/FormattedCurrency";
import type { ActiveCrossFilter } from "@/components/bi/desempenho/DesempenhoFilterBar";
import type { DesempenhoVendasData, DesempenhoVendasFilterOptions } from "@/types/desempenhoVendas";
import type { PedidosEsteiraData } from "@/services/bi/pedidosEsteiraService";

interface DesempenhoGanhosTabProps {
  data: DesempenhoVendasData;
  isLoading: boolean;
  targetYear: number;
  dateRange?: DateRange;
  onDateRangeChange: (range: DateRange | undefined) => void;
  esteiraData?: PedidosEsteiraData;
  esteiraLoading: boolean;
  esteiraPeriodoLabel: string;
  filterOptions: DesempenhoVendasFilterOptions;
  activeCrossFilter: ActiveCrossFilter | null;
  onCrossFilterClick: (type: ActiveCrossFilter["type"], label: string, value: string) => void;
  ganhosSummary: DesempenhoTableSummary;
  perdasSummary: DesempenhoTableSummary;
  onOpenPedidos: () => void;
  onOpenPerdidos: () => void;
}

export function DesempenhoGanhosTab({
  data,
  isLoading,
  targetYear,
  dateRange,
  onDateRangeChange,
  esteiraData,
  esteiraLoading,
  esteiraPeriodoLabel,
  filterOptions,
  activeCrossFilter,
  onCrossFilterClick,
  ganhosSummary,
  perdasSummary,
  onOpenPedidos,
  onOpenPerdidos,
}: DesempenhoGanhosTabProps) {
  const topVendedor = data.rankingVendedores[0] ?? null;
  const topProduto = data.rankingProdutos[0] ?? null;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <div onClick={onOpenPedidos} className="group relative cursor-pointer rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm transition-all duration-200 hover:border-emerald-500/50 hover:shadow-md">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Faturamento Ganho</span><DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
          {isLoading ? <Skeleton className="h-7 w-28 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-emerald-700 dark:text-emerald-400"><FormattedCurrency value={data.kpis.faturamento} /></p><div className="flex items-center justify-between text-[10px] text-[var(--voux-text-muted)] mt-0.5 pt-1 border-t border-[var(--voux-card-border)]/40 font-mono"><span>100% aprovados</span><span className="text-emerald-600 inline-flex items-center">Ver pedidos <ChevronRight className="h-3 w-3 ml-0.5" /></span></div></div>}
        </div>

        <div onClick={onOpenPedidos} className="group relative cursor-pointer rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm transition-all duration-200 hover:border-emerald-500/50 hover:shadow-md">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Pedidos Ganhos</span><ShoppingCart className="h-4 w-4 text-primary" /></div>
          {isLoading ? <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">{data.kpis.totalPedidos.toLocaleString("pt-BR")} <span className="text-xs font-normal">pedidos</span></p><div className="flex items-center justify-between text-[10px] text-[var(--voux-text-muted)] mt-0.5 pt-1 border-t border-[var(--voux-card-border)]/40 font-mono"><span>Ativações no período</span><span className="text-emerald-600 inline-flex items-center">Ver pedidos <ChevronRight className="h-3 w-3 ml-0.5" /></span></div></div>}
        </div>

        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Ticket Médio</span><TrendingUp className="h-4 w-4 text-primary" /></div>
          {isLoading ? <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-[var(--voux-text-primary)]"><FormattedCurrency value={data.kpis.ticketMedio} /></p><p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Por pedido concluído</p></div>}
        </div>

        <div onClick={onOpenPerdidos} className="group relative cursor-pointer rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm transition-all duration-200 hover:border-red-500/50 hover:shadow-md">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono text-red-600">Negócios Perdidos</span><XCircle className="h-4 w-4 text-red-600" /></div>
          {isLoading ? <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-red-600"><FormattedCurrency value={data.kpis.valorPerdido} /></p><div className="flex items-center justify-between text-[10px] text-[var(--voux-text-muted)] mt-0.5 pt-1 border-t border-[var(--voux-card-border)]/40 font-mono"><span>{data.kpis.totalPerdido} perdas</span><span className="text-red-600 inline-flex items-center">Ver perdas <ChevronRight className="h-3 w-3 ml-0.5" /></span></div></div>}
        </div>

        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Líder em Vendas</span><Trophy className="h-4 w-4 text-amber-500" /></div>{isLoading ? <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" /> : topVendedor ? <div><p className="text-[13px] font-bold text-[var(--voux-text-primary)] truncate uppercase">{topVendedor.name}</p><p className="text-[11px] font-mono font-semibold text-emerald-700 mt-0.5">{formatBRL(topVendedor.valor)} ({topVendedor.percent}%)</p></div> : <p className="text-xs text-[var(--voux-text-muted)]">—</p>}</div>
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Top Produto</span><Award className="h-4 w-4 text-primary" /></div>{isLoading ? <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" /> : topProduto ? <div><p className="text-[12px] font-bold text-[var(--voux-text-primary)] truncate">{topProduto.name}</p><p className="text-[11px] font-mono font-semibold text-emerald-700 mt-0.5">{topProduto.qtd} un · {formatBRL(topProduto.valor)}</p></div> : <p className="text-xs text-[var(--voux-text-muted)]">—</p>}</div>
      </div>

      <PedidosEsteiraCard variant="strip" data={esteiraData} isLoading={esteiraLoading} ano={targetYear} periodoLabel={esteiraPeriodoLabel} />
      {data.serieMensal.length > 0 && <DesempenhoDualLineChart data={data.serieMensal} ano={targetYear} loading={isLoading} summary={{ totalValorGanho: ganhosSummary.totalValor, totalQtdGanho: ganhosSummary.totalQtd, totalValorPerda: perdasSummary.totalValor, totalQtdPerda: perdasSummary.totalQtd }} />}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DesempenhoTableCard eyebrow="COMERCIAL" title="Vendas por vendedor" firstColumnHeader="VENDEDOR" rows={data.rankingVendedores} selectedItemName={activeCrossFilter?.type === "vendedor" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("vendedor", "Vendedor", row.name)} summary={ganhosSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="PRODUTOS" title="Produtos mais vendidos" firstColumnHeader="PRODUTO" rows={data.rankingProdutos.map((item) => ({ name: item.name, subtitle: item.marca ? `${item.marca} ${item.grupo ? `· ${item.grupo}` : ""}` : item.grupo, qtd: item.qtd, percent: item.percent, ticketMedio: item.ticketMedio, valor: item.valor }))} selectedItemName={activeCrossFilter?.type === "produto" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("produto", "Produto", row.name)} summary={ganhosSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="REGIONAL" title="Vendas por cidade de entrega" firstColumnHeader="CIDADE" rows={data.rankingCidades} selectedItemName={activeCrossFilter?.type === "cidade" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("cidade", "Cidade", row.name)} summary={ganhosSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="MARKETING" title="Origem do lead (Forma de Entrada)" firstColumnHeader="CANAL / ORIGEM" rows={data.origensLead} selectedItemName={activeCrossFilter?.type === "origem" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("origem", "Origem", row.name)} summary={ganhosSummary} loading={isLoading} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DesempenhoDonutCard eyebrow="MODALIDADE DE PAGAMENTO" title="Vendas por instituição financeira" items={data.financiamentoBancos} selectedItemName={activeCrossFilter?.type === "banco" ? activeCrossFilter.value : null} onItemClick={(item) => onCrossFilterClick("banco", "Banco/Modalidade", item.name)} summary={ganhosSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="OPORTUNIDADES PERDIDAS · CRM" title="Motivos de perda de negócios" firstColumnHeader="MOTIVO / CONCORRENTE" variant="red" unitLabel="negócios perdidos" rows={data.motivosPerda.map((item) => ({ name: item.name, subtitle: item.concorrenteTop ? `Concorrente: ${item.concorrenteTop}` : undefined, qtd: item.qtd, percent: item.percent, ticketMedio: item.ticketMedio ?? null, valor: item.valor }))} selectedItemName={activeCrossFilter?.type === "motivo" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("motivo", "Motivo de Perda", row.name)} summary={perdasSummary} loading={isLoading} />
      </div>

      <DesempenhoDetalheListas {...filterOptions} defaultTab="ganhos" />

      {data.resumoAnual.length > 0 && <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm"><div className="mb-4"><p className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)] font-mono">VISÃO HISTÓRICA MULTIANUAL</p><h2 className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5">Evolução e Comparativo Anual</h2></div><div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">{data.resumoAnual.map((item) => { const isYearSelected = Boolean(dateRange?.from && dateRange?.to && dateRange.from.getFullYear() === item.ano && dateRange.to.getFullYear() === item.ano && dateRange.from.getMonth() === 0 && dateRange.from.getDate() === 1 && dateRange.to.getMonth() === 11 && dateRange.to.getDate() === 31); return <button type="button" key={item.ano} onClick={() => onDateRangeChange({ from: new Date(item.ano, 0, 1), to: new Date(item.ano, 11, 31) })} className={cn("p-4 rounded-xl border transition-all text-left", isYearSelected ? "border-emerald-600 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-600" : "border-[var(--voux-card-border)] bg-[var(--voux-surface)] hover:border-emerald-600/50")}><div className="flex items-center justify-between text-xs font-semibold text-[var(--voux-text-muted)]"><span className="font-mono text-[14px] text-[var(--voux-text-primary)] font-bold">{item.ano}</span><span>{item.qtd} pedidos</span></div><p className="text-[18px] font-bold text-emerald-700 mt-2"><FormattedCurrency value={item.faturamento} /></p><p className="text-[11px] text-[var(--voux-text-muted)] font-mono mt-0.5">Ticket Médio: {formatBRL(item.ticketMedio)}</p></button>; })}</div></div>}
    </div>
  );
}
