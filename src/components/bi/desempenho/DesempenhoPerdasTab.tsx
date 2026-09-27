import { AlertTriangle, DollarSign, Flame, PieChart, Target, XCircle, ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { DesempenhoDetalheListas } from "@/components/bi/desempenho/DesempenhoDetalheListas";
import { DesempenhoDualLineChart } from "@/components/bi/desempenho/DesempenhoDualLineChart";
import { DesempenhoTableCard, type DesempenhoTableSummary } from "@/components/bi/desempenho/DesempenhoTableCard";
import { FormattedCurrency } from "@/components/bi/desempenho/FormattedCurrency";
import type { ActiveCrossFilter } from "@/components/bi/desempenho/DesempenhoFilterBar";
import type { DesempenhoVendasData, DesempenhoVendasFilterOptions } from "@/types/desempenhoVendas";

interface DesempenhoPerdasTabProps {
  data: DesempenhoVendasData;
  isLoading: boolean;
  targetYear: number;
  filterOptions: DesempenhoVendasFilterOptions;
  activeCrossFilter: ActiveCrossFilter | null;
  onCrossFilterClick: (type: ActiveCrossFilter["type"], label: string, value: string) => void;
  ganhosSummary: DesempenhoTableSummary;
  perdasSummary: DesempenhoTableSummary;
  onOpenPedidos: () => void;
  onOpenPerdidos: () => void;
}

export function DesempenhoPerdasTab({
  data,
  isLoading,
  targetYear,
  filterOptions,
  activeCrossFilter,
  onCrossFilterClick,
  ganhosSummary,
  perdasSummary,
  onOpenPedidos,
  onOpenPerdidos,
}: DesempenhoPerdasTabProps) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        <div onClick={onOpenPerdidos} className="group relative cursor-pointer rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm hover:border-red-500/50 hover:shadow-md"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono text-red-600">Total Perdido</span><XCircle className="h-4 w-4 text-red-600" /></div>{isLoading ? <Skeleton className="h-7 w-28 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-red-600"><FormattedCurrency value={data.kpis.valorPerdido} /></p><div className="flex items-center justify-between text-[10px] text-[var(--voux-text-muted)] mt-0.5 pt-1 border-t border-[var(--voux-card-border)]/40 font-mono"><span>Volume de propostas</span><span className="text-red-600 inline-flex items-center">Ver perdas <ChevronRight className="h-3 w-3 ml-0.5" /></span></div></div>}</div>
        <div onClick={onOpenPerdidos} className="group relative cursor-pointer rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm hover:border-red-500/50 hover:shadow-md"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Negócios Perdidos</span><AlertTriangle className="h-4 w-4 text-red-500" /></div>{isLoading ? <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">{data.kpis.totalPerdido.toLocaleString("pt-BR")} <span className="text-xs font-normal">negócios</span></p><div className="flex items-center justify-between text-[10px] text-[var(--voux-text-muted)] mt-0.5 pt-1 border-t border-[var(--voux-card-border)]/40 font-mono"><span>Desistências no CRM</span><span className="text-red-600 inline-flex items-center">Ver perdas <ChevronRight className="h-3 w-3 ml-0.5" /></span></div></div>}</div>
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Ticket Médio Perdido</span><Target className="h-4 w-4 text-[var(--voux-text-muted)]" /></div>{isLoading ? <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-[var(--voux-text-primary)]"><FormattedCurrency value={data.kpis.ticketMedioPerdido} /></p><p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Por negócio não concretizado</p></div>}</div>
        <div onClick={onOpenPedidos} className="group relative cursor-pointer rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm hover:border-emerald-500/50 hover:shadow-md"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Ganhos (Benchmark)</span><DollarSign className="h-4 w-4 text-emerald-600" /></div>{isLoading ? <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-emerald-700"><FormattedCurrency value={data.kpis.faturamento} /></p><div className="flex items-center justify-between text-[10px] text-[var(--voux-text-muted)] mt-0.5 pt-1 border-t border-[var(--voux-card-border)]/40 font-mono"><span>{data.kpis.totalPedidos} aprovados</span><span className="text-emerald-600 inline-flex items-center">Ver pedidos <ChevronRight className="h-3 w-3 ml-0.5" /></span></div></div>}</div>
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Taxa de Conversão</span><PieChart className="h-4 w-4 text-primary" /></div>{isLoading ? <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">{Number.isFinite(data.kpis.taxaConversao) ? `${data.kpis.taxaConversao.toFixed(1)}%` : "—"}</p><p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Ganhos vs Decididos</p></div>}</div>
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm"><div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1"><span className="text-[10px] font-bold tracking-wider uppercase font-mono">Em Aberto no Pipeline</span><Flame className="h-4 w-4 text-amber-500" /></div>{isLoading ? <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" /> : <div><p className="text-[18px] md:text-[20px] font-bold text-amber-600"><FormattedCurrency value={data.kpis.valorEmAndamento} /></p><p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">{data.kpis.totalEmAndamento.toLocaleString("pt-BR")} propostas ativas</p></div>}</div>
      </div>

      {data.serieMensal.length > 0 && <DesempenhoDualLineChart data={data.serieMensal} ano={targetYear} loading={isLoading} summary={{ totalValorGanho: ganhosSummary.totalValor, totalQtdGanho: ganhosSummary.totalQtd, totalValorPerda: perdasSummary.totalValor, totalQtdPerda: perdasSummary.totalQtd }} />}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DesempenhoTableCard eyebrow="DIAGNÓSTICO CRM" title="Motivos de perda de negócios" firstColumnHeader="MOTIVO / CONCORRENTE" variant="red" unitLabel="negócios perdidos" rows={(data.perdas?.motivosPerda ?? data.motivosPerda).map((item) => ({ name: item.name, subtitle: item.concorrenteTop ? `Concorrente: ${item.concorrenteTop}` : undefined, qtd: item.qtd, percent: item.percent, ticketMedio: item.ticketMedio ?? null, valor: item.valor }))} selectedItemName={activeCrossFilter?.type === "motivo" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("motivo", "Motivo de Perda", row.name)} summary={perdasSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="POR VENDEDOR" title="Quem mais perde negócios" firstColumnHeader="VENDEDOR" variant="red" unitLabel="negócios perdidos" rows={data.perdas?.rankingVendedores ?? []} selectedItemName={activeCrossFilter?.type === "vendedor" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("vendedor", "Vendedor", row.name)} summary={perdasSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="POR PRODUTO &amp; GRUPO" title="Produtos / modelos mais perdidos" firstColumnHeader="PRODUTO / MODELO" variant="red" unitLabel="negócios perdidos" rows={(data.perdas?.rankingProdutos ?? []).map((item) => ({ name: item.name, subtitle: item.marca ? `${item.marca} ${item.grupo ? `· ${item.grupo}` : ""}` : item.grupo, qtd: item.qtd, percent: item.percent, ticketMedio: item.ticketMedio, valor: item.valor }))} selectedItemName={activeCrossFilter?.type === "produto" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("produto", "Produto", row.name)} summary={perdasSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="POR CIDADE &amp; REGIÃO" title="Cidades com maior perda de negócios" firstColumnHeader="CIDADE" variant="red" unitLabel="negócios perdidos" rows={data.perdas?.rankingCidades ?? []} selectedItemName={activeCrossFilter?.type === "cidade" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("cidade", "Cidade", row.name)} summary={perdasSummary} loading={isLoading} />
        <DesempenhoTableCard eyebrow="ORIGEM DO LEAD &amp; MARKETING" title="Perdas por canal de entrada" firstColumnHeader="ORIGEM / CANAL" variant="red" unitLabel="negócios perdidos" rows={(data.perdas?.origensLead ?? []).map((item) => ({ name: item.name, qtd: item.qtd, percent: item.percent, ticketMedio: item.ticketMedio, valor: item.valor }))} selectedItemName={activeCrossFilter?.type === "origem" ? activeCrossFilter.value : null} onRowClick={(row) => onCrossFilterClick("origem", "Origem", row.name)} summary={perdasSummary} loading={isLoading} />
      </div>
      <DesempenhoDetalheListas {...filterOptions} defaultTab="perdidos" />
    </div>
  );
}
