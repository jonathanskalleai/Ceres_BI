import { useState, useMemo } from "react";
import { type DateRange } from "react-day-picker";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  Target,
  XCircle,
  Trophy,
  Award,
  AlertTriangle,
  Flame,
  PieChart,
} from "lucide-react";
import { toISODate, formatBRL } from "@/lib/dateUtils";
import { useDesempenhoVendas } from "@/hooks/bi/useDesempenhoVendas";
import { usePedidosEsteira } from "@/hooks/bi/usePedidosEsteira";
import { PedidosEsteiraCard } from "@/components/bi/pedidos/PedidosEsteiraCard";
import { DesempenhoTableCard } from "@/components/bi/desempenho/DesempenhoTableCard";
import { DesempenhoDonutCard } from "@/components/bi/desempenho/DesempenhoDonutCard";
import { DesempenhoDualLineChart } from "@/components/bi/desempenho/DesempenhoDualLineChart";
import {
  DesempenhoFilterBar,
  type DesempenhoTab,
  type ActiveCrossFilter,
} from "@/components/bi/desempenho/DesempenhoFilterBar";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** Componente de Tipografia Refinada para Valores Financeiros com R$ Sutil */
function FormattedCurrency({ value, className }: { value: number; className?: string }) {
  const formatted = formatBRL(value);
  const numberPart = formatted.replace(/^R\$\s*/, "");
  return (
    <span className={cn("inline-flex items-baseline font-mono tabular-nums", className)}>
      <span className="text-[11px] font-normal text-[var(--voux-text-muted)] mr-1 tracking-normal select-none">
        R$
      </span>
      <span>{numberPart}</span>
    </span>
  );
}

export default function BiDesempenhoVendas() {
  // Aba ativa: padrão "ganhos" (Vendas), com opção "perdas" (Diagnóstico de Perdas)
  const [activeTab, setActiveTab] = useState<DesempenhoTab>("ganhos");

  // Estado de filtros principais
  const currentYear = new Date().getFullYear();
  const [selectedAno, setSelectedAno] = useState<number | null>(currentYear);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [selectedCidade, setSelectedCidade] = useState<string>("");

  // Estado de Filtro Cruzado Interativo (PowerBI / Tableau Style)
  const [activeCrossFilter, setActiveCrossFilter] = useState<ActiveCrossFilter | null>(null);

  const handleCrossFilterClick = (type: ActiveCrossFilter["type"], label: string, value: string) => {
    if (activeCrossFilter?.type === type && activeCrossFilter.value.toLowerCase() === value.toLowerCase()) {
      // Toggle off / Limpa
      setActiveCrossFilter(null);
    } else {
      setActiveCrossFilter({ type, label, value });
    }
  };

  const handleClearCrossFilter = () => {
    setActiveCrossFilter(null);
  };

  // Monta opções de filtro para o hook (incluindo filtro cruzado)
  const filterOptions = useMemo(() => {
    return {
      ano: selectedAno,
      from: dateRange?.from ? toISODate(dateRange.from) : null,
      to: dateRange?.to ? toISODate(dateRange.to) : dateRange?.from ? toISODate(dateRange.from) : null,
      vendedor: activeCrossFilter?.type === "vendedor" ? activeCrossFilter.value : selectedVendedor || null,
      cidade: activeCrossFilter?.type === "cidade" ? activeCrossFilter.value : selectedCidade || null,
      produto: activeCrossFilter?.type === "produto" ? activeCrossFilter.value : null,
      origem: activeCrossFilter?.type === "origem" ? activeCrossFilter.value : null,
      banco: activeCrossFilter?.type === "banco" ? activeCrossFilter.value : null,
      motivoPerda: activeCrossFilter?.type === "motivo" ? activeCrossFilter.value : null,
    };
  }, [selectedAno, dateRange, selectedVendedor, selectedCidade, activeCrossFilter]);

  const { data, isLoading, refetch, isFetching } = useDesempenhoVendas(filterOptions);
  const { data: esteiraData, isLoading: esteiraLoading } = usePedidosEsteira({
    ano: selectedAno,
    from: filterOptions.from,
    to: filterOptions.to,
    vendedor: filterOptions.vendedor,
    cidade: filterOptions.cidade,
  });

  // Lista de opções únicas para selects
  const vendedorOptions = useMemo(() => {
    const list = activeTab === "perdas"
      ? data.perdas?.rankingVendedores ?? []
      : data.rankingVendedores;
    const set = new Set(list.map((v) => v.name));
    return Array.from(set).filter(Boolean);
  }, [activeTab, data.perdas?.rankingVendedores, data.rankingVendedores]);

  const cidadeOptions = useMemo(() => {
    const list = activeTab === "perdas"
      ? data.perdas?.rankingCidades ?? []
      : data.rankingCidades;
    const set = new Set(list.map((c) => c.name));
    return Array.from(set).filter(Boolean);
  }, [activeTab, data.perdas?.rankingCidades, data.rankingCidades]);

  const hasActiveFilters = Boolean(
    selectedAno !== currentYear ||
      dateRange?.from ||
      dateRange?.to ||
      selectedVendedor ||
      selectedCidade ||
      activeCrossFilter
  );

  const handleResetFilters = () => {
    setSelectedAno(currentYear);
    setDateRange(undefined);
    setSelectedVendedor("");
    setSelectedCidade("");
    setActiveCrossFilter(null);
  };

  // Top destaques para cards rápidos
  const topVendedor = data.rankingVendedores[0] || null;
  const topProduto = data.rankingProdutos[0] || null;

  // KPIs calculados para Perdas
  const totalPerdidoCount = data.perdas?.motivosPerda?.reduce((acc, m) => acc + m.qtd, 0) || data.kpis.qtdPerdido;
  const valorPerdidoTotal = data.perdas?.motivosPerda?.reduce((acc, m) => acc + m.valor, 0) || data.kpis.valorPerdido;
  const ticketMedioPerda = totalPerdidoCount > 0 ? valorPerdidoTotal / totalPerdidoCount : data.kpis.ticketMedioPerdido;
  const totalDecididos = (data.kpis.totalPedidos || 0) + totalPerdidoCount;
  const taxaConversao = totalDecididos > 0 ? ((data.kpis.totalPedidos || 0) / totalDecididos) * 100 : 0;

  return (
    <div className="px-4 sm:px-6 lg:px-10 pb-12 space-y-5 max-w-full">
      {/* Barra de Filtros e Abas Integrada com Frosted Glass Sticky */}
      <DesempenhoFilterBar
        activeTab={activeTab}
        onTabChange={(tab) => {
          setActiveTab(tab);
          setActiveCrossFilter(null); // Reseta filtro cruzado ao alternar de aba
        }}
        ano={selectedAno}
        onAnoChange={setSelectedAno}
        dateRange={dateRange}
        onDateRangeChange={setDateRange}
        vendedor={selectedVendedor}
        onVendedorChange={setSelectedVendedor}
        vendedorOptions={vendedorOptions}
        cidade={selectedCidade}
        onCidadeChange={setSelectedCidade}
        cidadeOptions={cidadeOptions}
        activeCrossFilter={activeCrossFilter}
        onClearCrossFilter={handleClearCrossFilter}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {/* ========================================================================= */}
      {/* ABA 1: 🟢 VENDAS & GANHOS (Padrão) */}
      {/* ========================================================================= */}
      {activeTab === "ganhos" && (
        <div className="space-y-5">
          {/* Ribbon de KPIs Resumo de Vendas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {/* KPI 1: Faturamento Ganhos */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Faturamento Ganho
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-28 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-emerald-700 dark:text-emerald-400">
                    <FormattedCurrency value={data.kpis.faturamento} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">100% pedidos aprovados</p>
                </div>
              )}
            </div>

            {/* KPI 2: Quantidade de Pedidos Ganhos */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Pedidos Ganhos
                </span>
                <ShoppingCart className="h-4 w-4 text-primary" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">
                    {data.kpis.totalPedidos.toLocaleString("pt-BR")} <span className="text-xs font-normal">pedidos</span>
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Ativações no período</p>
                </div>
              )}
            </div>

            {/* KPI 3: Ticket Médio Geral */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Ticket Médio
                </span>
                <TrendingUp className="h-4 w-4 text-primary" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-[var(--voux-text-primary)]">
                    <FormattedCurrency value={data.kpis.ticketMedio} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Por pedido concluído</p>
                </div>
              )}
            </div>

            {/* KPI 4: Perdas no Período */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-red-600 dark:text-red-400">
                  Negócios Perdidos
                </span>
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-red-600 dark:text-red-400">
                    <FormattedCurrency value={data.kpis.valorPerdido} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">
                    {totalPerdidoCount} desistências/perdas
                  </p>
                </div>
              )}
            </div>

            {/* KPI 5: Top Vendedor */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Líder em Vendas
                </span>
                <Trophy className="h-4 w-4 text-amber-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
              ) : topVendedor ? (
                <div>
                  <p className="text-[13px] font-bold text-[var(--voux-text-primary)] truncate uppercase" title={topVendedor.name}>
                    {topVendedor.name}
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {formatBRL(topVendedor.valor)} ({topVendedor.percent}%)
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--voux-text-muted)]">—</p>
              )}
            </div>

            {/* KPI 6: Top Produto */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Top Produto
                </span>
                <Award className="h-4 w-4 text-primary" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
              ) : topProduto ? (
                <div>
                  <p className="text-[12px] font-bold text-[var(--voux-text-primary)] truncate" title={topProduto.name}>
                    {topProduto.name}
                  </p>
                  <p className="text-[11px] font-mono font-semibold text-emerald-700 dark:text-emerald-400 mt-0.5">
                    {topProduto.qtd} un · {formatBRL(topProduto.valor)}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-[var(--voux-text-muted)]">—</p>
              )}
            </div>
          </div>

          {/* ESTEIRA DE PEDIDOS EM FECHAMENTO (Aguardando Aprovação e Aguardando Assinatura) */}
          <PedidosEsteiraCard
            variant="strip"
            data={esteiraData}
            isLoading={esteiraLoading}
            ano={selectedAno}
          />

          {/* Gráfico Comparativo Dual Line */}
          {data.serieMensal.length > 0 && (
            <DesempenhoDualLineChart
              data={data.serieMensal}
              ano={selectedAno || currentYear}
              loading={isLoading}
            />
          )}

          {/* Grid de Tabelas Analíticas de Vendas com Filtro Cruzado Interativo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: VENDAS POR VENDEDOR */}
            <DesempenhoTableCard
              eyebrow="COMERCIAL"
              title="Vendas por vendedor"
              firstColumnHeader="VENDEDOR"
              rows={data.rankingVendedores}
              selectedItemName={activeCrossFilter?.type === "vendedor" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("vendedor", "Vendedor", row.name)}
              loading={isLoading}
            />

            {/* Card 2: PRODUTOS MAIS VENDIDOS */}
            <DesempenhoTableCard
              eyebrow="PRODUTOS"
              title="Produtos mais vendidos"
              firstColumnHeader="PRODUTO"
              rows={data.rankingProdutos.map((p) => ({
                name: p.name,
                subtitle: p.marca ? `${p.marca} ${p.grupo ? `· ${p.grupo}` : ""}` : p.grupo,
                qtd: p.qtd,
                percent: p.percent,
                ticketMedio: p.ticketMedio,
                valor: p.valor,
              }))}
              selectedItemName={activeCrossFilter?.type === "produto" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("produto", "Produto", row.name)}
              loading={isLoading}
            />

            {/* Card 3: VENDAS POR CIDADE / FILIAL */}
            <DesempenhoTableCard
              eyebrow="REGIONAL"
              title="Vendas por cidade de entrega"
              firstColumnHeader="CIDADE"
              rows={data.rankingCidades}
              selectedItemName={activeCrossFilter?.type === "cidade" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("cidade", "Cidade", row.name)}
              loading={isLoading}
            />

            {/* Card 4: ORIGEM DO LEAD / MARKETING */}
            <DesempenhoTableCard
              eyebrow="MARKETING"
              title="Origem do lead (Forma de Entrada)"
              firstColumnHeader="CANAL / ORIGEM"
              rows={data.origensLead}
              selectedItemName={activeCrossFilter?.type === "origem" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("origem", "Origem", row.name)}
              loading={isLoading}
            />
          </div>

          {/* Grid de Apoio: Financiamento & Motivos de Perda no Rodapé */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 5: MODALIDADE DE PAGAMENTO / BANCOS */}
            <DesempenhoDonutCard
              eyebrow="MODALIDADE DE PAGAMENTO"
              title="Vendas por instituição financeira"
              items={data.financiamentoBancos.map((b) => ({
                name: b.name,
                qtd: b.qtd,
                valor: b.valor,
                ticketMedio: b.ticketMedio,
                percent: b.percent,
              }))}
              selectedItemName={activeCrossFilter?.type === "banco" ? activeCrossFilter.value : null}
              onItemClick={(item) => handleCrossFilterClick("banco", "Banco/Modalidade", item.name)}
              loading={isLoading}
            />

            {/* Card 6: MOTIVOS DE PERDA DE NEGÓCIOS NO CRM */}
            <DesempenhoTableCard
              eyebrow="OPORTUNIDADES PERDIDAS · CRM"
              title="Motivos de perda de negócios"
              firstColumnHeader="MOTIVO / CONCORRENTE"
              variant="red"
              unitLabel="negócios perdidos"
              rows={data.motivosPerda.map((m) => ({
                name: m.name,
                subtitle: m.concorrenteTop ? `Concorrente: ${m.concorrenteTop}` : undefined,
                qtd: m.qtd,
                percent: m.percent,
                ticketMedio: m.qtd > 0 ? m.valor / m.qtd : 0,
                valor: m.valor,
              }))}
              selectedItemName={activeCrossFilter?.type === "motivo" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("motivo", "Motivo de Perda", row.name)}
              loading={isLoading}
            />
          </div>

          {/* Resumo Histórico Anual */}
          {data.resumoAnual.length > 0 && (
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm">
              <div className="mb-4">
                <p
                  className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)] font-mono"
                >
                  VISÃO HISTÓRICA MULTIANUAL
                </p>
                <h2
                  className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
                  style={{ fontFamily: "var(--voux-font-display)" }}
                >
                  Evolução e Comparativo Anual
                </h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                {data.resumoAnual.map((res) => (
                  <div
                    key={res.ano}
                    onClick={() => setSelectedAno(res.ano)}
                    className={cn(
                      "p-4 rounded-xl border transition-all cursor-pointer",
                      selectedAno === res.ano
                        ? "border-emerald-600 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-600"
                        : "border-[var(--voux-card-border)] bg-[var(--voux-surface)] hover:border-emerald-600/50"
                    )}
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--voux-text-muted)]">
                      <span className="font-mono text-[14px] text-[var(--voux-text-primary)] font-bold">{res.ano}</span>
                      <span>{res.qtd} pedidos</span>
                    </div>
                    <p className="text-[18px] font-bold text-emerald-700 dark:text-emerald-400 mt-2">
                      <FormattedCurrency value={res.faturamento} />
                    </p>
                    <p className="text-[11px] text-[var(--voux-text-muted)] font-mono mt-0.5">
                      Ticket Médio: {formatBRL(res.ticketMedio)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* ABA 2: 🔴 DIAGNÓSTICO DE PERDAS & CONCORRÊNCIA */}
      {/* ========================================================================= */}
      {activeTab === "perdas" && (
        <div className="space-y-5">
          {/* Ribbon de KPIs Dedicado para Perdas */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
            {/* KPI 1: Volume Total Perdido */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-red-600 dark:text-red-400">
                  Total Perdido
                </span>
                <XCircle className="h-4 w-4 text-red-600 dark:text-red-400" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-28 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-red-600 dark:text-red-400">
                    <FormattedCurrency value={data.kpis.valorPerdido} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Volume de propostas perdidas</p>
                </div>
              )}
            </div>

            {/* KPI 2: Oportunidades Perdidas */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Negócios Perdidos
                </span>
                <AlertTriangle className="h-4 w-4 text-red-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">
                    {totalPerdidoCount.toLocaleString("pt-BR")} <span className="text-xs font-normal">negócios</span>
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Desistências e recusas no CRM</p>
                </div>
              )}
            </div>

            {/* KPI 3: Ticket Médio Perdido */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Ticket Médio Perdido
                </span>
                <Target className="h-4 w-4 text-[var(--voux-text-muted)]" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-[var(--voux-text-primary)]">
                    <FormattedCurrency value={ticketMedioPerda} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Por negócio não concretizado</p>
                </div>
              )}
            </div>

            {/* KPI 4: Vendas Ganhas (Comparativo) */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Ganhos (Benchmark)
                </span>
                <DollarSign className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-emerald-700 dark:text-emerald-400">
                    <FormattedCurrency value={data.kpis.faturamento} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">
                    {data.kpis.totalPedidos} vendas aprovadas
                  </p>
                </div>
              )}
            </div>

            {/* KPI 5: Taxa de Conversão do Funil */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Taxa de Conversão
                </span>
                <PieChart className="h-4 w-4 text-primary" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">
                    {taxaConversao.toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Ganhos vs Decididos</p>
                </div>
              )}
            </div>

            {/* KPI 6: Pipeline em Andamento */}
            <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
              <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
                <span className="text-[10px] font-bold tracking-wider uppercase font-mono">
                  Em Aberto no Pipeline
                </span>
                <Flame className="h-4 w-4 text-amber-500" />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
              ) : (
                <div>
                  <p className="text-[18px] md:text-[20px] font-bold text-amber-600 dark:text-amber-400">
                    <FormattedCurrency value={data.kpis.valorEmAndamento || data.kpis.pipelineAberto || 0} />
                  </p>
                  <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">
                    {data.kpis.totalEmAndamento ?? 0} propostas ativas
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Gráfico Comparativo Dual Line */}
          {data.serieMensal.length > 0 && (
            <DesempenhoDualLineChart
              data={data.serieMensal}
              ano={selectedAno || currentYear}
              loading={isLoading}
            />
          )}

          {/* Grid de Tabelas de Diagnóstico de Perdas com Filtro Cruzado Interativo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: Motivos de Perda & Concorrentes */}
            <DesempenhoTableCard
              eyebrow="DIAGNÓSTICO CRM"
              title="Motivos de perda de negócios"
              firstColumnHeader="MOTIVO / CONCORRENTE"
              variant="red"
              unitLabel="negócios perdidos"
              rows={(data.perdas?.motivosPerda ?? data.motivosPerda).map((m) => ({
                name: m.name,
                subtitle: m.concorrenteTop ? `Concorrente: ${m.concorrenteTop}` : undefined,
                qtd: m.qtd,
                percent: m.percent,
                ticketMedio: m.ticketMedio || (m.qtd > 0 ? m.valor / m.qtd : 0),
                valor: m.valor,
              }))}
              selectedItemName={activeCrossFilter?.type === "motivo" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("motivo", "Motivo de Perda", row.name)}
              loading={isLoading}
            />

            {/* Card 2: Quem Mais Perde Negócios (Vendedores) */}
            <DesempenhoTableCard
              eyebrow="POR VENDEDOR"
              title="Quem mais perde negócios"
              firstColumnHeader="VENDEDOR"
              variant="red"
              unitLabel="negócios perdidos"
              rows={data.perdas?.rankingVendedores ?? []}
              selectedItemName={activeCrossFilter?.type === "vendedor" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("vendedor", "Vendedor", row.name)}
              loading={isLoading}
            />

            {/* Card 3: Produtos Mais Perdidos */}
            <DesempenhoTableCard
              eyebrow="POR PRODUTO &amp; GRUPO"
              title="Produtos / modelos mais perdidos"
              firstColumnHeader="PRODUTO / MODELO"
              variant="red"
              unitLabel="negócios perdidos"
              rows={(data.perdas?.rankingProdutos ?? []).map((p) => ({
                name: p.name,
                subtitle: p.marca ? `${p.marca} ${p.grupo ? `· ${p.grupo}` : ""}` : p.grupo,
                qtd: p.qtd,
                percent: p.percent,
                ticketMedio: p.ticketMedio,
                valor: p.valor,
              }))}
              selectedItemName={activeCrossFilter?.type === "produto" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("produto", "Produto", row.name)}
              loading={isLoading}
            />

            {/* Card 4: Cidades com Mais Perdas */}
            <DesempenhoTableCard
              eyebrow="POR CIDADE &amp; REGIÃO"
              title="Cidades com maior perda de negócios"
              firstColumnHeader="CIDADE"
              variant="red"
              unitLabel="negócios perdidos"
              rows={data.perdas?.rankingCidades ?? []}
              selectedItemName={activeCrossFilter?.type === "cidade" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("cidade", "Cidade", row.name)}
              loading={isLoading}
            />

            {/* Card 5: Origens do Lead com Menor Conversão */}
            <DesempenhoTableCard
              eyebrow="ORIGEM DO LEAD &amp; MARKETING"
              title="Perdas por canal de entrada"
              firstColumnHeader="ORIGEM / CANAL"
              variant="red"
              unitLabel="negócios perdidos"
              rows={(data.perdas?.origensLead ?? []).map((o) => ({
                name: o.name,
                qtd: o.qtd,
                percent: o.percent,
                ticketMedio: o.ticketMedio,
                valor: o.valor,
              }))}
              selectedItemName={activeCrossFilter?.type === "origem" ? activeCrossFilter.value : null}
              onRowClick={(row) => handleCrossFilterClick("origem", "Origem", row.name)}
              loading={isLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
