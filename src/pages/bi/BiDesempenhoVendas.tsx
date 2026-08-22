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
  Building2,
  Users,
  PieChart,
} from "lucide-react";
import { toISODate, formatBRL } from "@/lib/dateUtils";
import { useDesempenhoVendas } from "@/hooks/bi/useDesempenhoVendas";
import { DesempenhoTableCard } from "@/components/bi/desempenho/DesempenhoTableCard";
import { DesempenhoDonutCard } from "@/components/bi/desempenho/DesempenhoDonutCard";
import { DesempenhoDualLineChart } from "@/components/bi/desempenho/DesempenhoDualLineChart";
import {
  DesempenhoFilterBar,
  type DesempenhoTab,
} from "@/components/bi/desempenho/DesempenhoFilterBar";
import { Skeleton } from "@/components/ui/skeleton";

export default function BiDesempenhoVendas() {
  // Aba ativa: padrão "ganhos" (Vendas), com opção "perdas" (Diagnóstico de Perdas)
  const [activeTab, setActiveTab] = useState<DesempenhoTab>("ganhos");

  // Estado de filtros
  const currentYear = new Date().getFullYear();
  const [selectedAno, setSelectedAno] = useState<number | null>(currentYear);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [selectedVendedor, setSelectedVendedor] = useState<string>("");
  const [selectedCidade, setSelectedCidade] = useState<string>("");
  const [selectedCondicao, setSelectedCondicao] = useState<string>("");

  // Monta opções de filtro para o hook
  const filterOptions = useMemo(() => {
    return {
      ano: selectedAno,
      from: dateRange?.from ? toISODate(dateRange.from) : null,
      to: dateRange?.to ? toISODate(dateRange.to) : dateRange?.from ? toISODate(dateRange.from) : null,
      vendedor: selectedVendedor || null,
      cidade: selectedCidade || null,
      condicao: selectedCondicao || null,
    };
  }, [selectedAno, dateRange, selectedVendedor, selectedCidade, selectedCondicao]);

  const { data, isLoading, refetch, isFetching } = useDesempenhoVendas(filterOptions);

  // Lista de opções únicas para selects
  const vendedorOptions = useMemo(() => {
    const list = activeTab === "perdas"
      ? data.perdas?.rankingVendedores ?? []
      : data.rankingVendedores;
    const set = new Set(list.map((v) => v.name));
    return Array.from(set).filter(Boolean);
  }, [activeTab, data.rankingVendedores, data.perdas?.rankingVendedores]);

  const cidadeOptions = useMemo(() => {
    const list = activeTab === "perdas"
      ? data.perdas?.rankingCidades ?? []
      : data.rankingCidades;
    const set = new Set(list.map((c) => c.name));
    return Array.from(set).filter(Boolean);
  }, [activeTab, data.rankingCidades, data.perdas?.rankingCidades]);

  const handleResetFilters = () => {
    setSelectedAno(currentYear);
    setDateRange(undefined);
    setSelectedVendedor("");
    setSelectedCidade("");
    setSelectedCondicao("");
  };

  const hasActiveFilters =
    selectedAno !== currentYear ||
    Boolean(dateRange?.from) ||
    Boolean(selectedVendedor) ||
    Boolean(selectedCidade) ||
    Boolean(selectedCondicao);

  const topVendedor = data.rankingVendedores[0];
  const topProduto = data.rankingProdutos[0];

  const totalPerdidoCount = data.kpis.totalPerdido ?? data.kpis.qtdPerdido ?? 0;
  const ticketMedioPerda = data.kpis.ticketMedioPerdido || (totalPerdidoCount > 0 ? data.kpis.valorPerdido / totalPerdidoCount : 0);
  const totalGeralOportunidades = data.kpis.totalPedidos + totalPerdidoCount;
  const taxaConversao = totalGeralOportunidades > 0 ? (data.kpis.totalPedidos / totalGeralOportunidades) * 100 : 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Barra Unificada de Abas + Filtros (Espaço Otimizado sem repetição de títulos) */}
      <DesempenhoFilterBar
        activeTab={activeTab}
        onTabChange={setActiveTab}
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
        condicao={selectedCondicao}
        onCondicaoChange={setSelectedCondicao}
        onResetFilters={handleResetFilters}
        hasActiveFilters={hasActiveFilters}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      {/* ========================================================================= */}
      {/* ABA 1: 🟢 VENDAS & GANHOS (PADRÃO) */}
      {/* ========================================================================= */}
      {activeTab === "ganhos" && (
        <div className="space-y-5">
          {/* Ribbon de KPIs Principais de Vendas */}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {formatBRL(data.kpis.faturamento)}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">
                    {formatBRL(data.kpis.ticketMedio)}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-red-600 dark:text-red-400">
                    {formatBRL(data.kpis.valorPerdido)}
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

          {/* Gráfico de Linhas Ganhos vs Perdas */}
          {data.serieMensal.length > 0 && (
            <DesempenhoDualLineChart
              data={data.serieMensal}
              ano={selectedAno || currentYear}
              loading={isLoading}
            />
          )}

          {/* Grid Principal 2x2 — Tabelas de Vendas (100% Conciliadas) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 1: POR VENDEDOR -> Quem vende mais */}
            <DesempenhoTableCard
              eyebrow="POR VENDEDOR"
              title="Quem vende mais"
              firstColumnHeader="VENDEDOR"
              rows={data.rankingVendedores}
              loading={isLoading}
            />

            {/* Card 2: POR PRODUTO & GRUPO -> Produtos mais vendidos */}
            <DesempenhoTableCard
              eyebrow="POR PRODUTO &amp; GRUPO"
              title="Produtos mais vendidos"
              firstColumnHeader="PRODUTO / MODELO"
              rows={data.rankingProdutos.map((p) => ({
                name: p.name,
                subtitle: p.marca ? `${p.marca} ${p.grupo ? `· ${p.grupo}` : ""}` : p.grupo,
                qtd: p.qtd,
                percent: p.percent,
                ticketMedio: p.ticketMedio,
                valor: p.valor,
              }))}
              loading={isLoading}
            />

            {/* Card 3: POR CIDADE & FILIAL -> Cidades com mais ativações */}
            <DesempenhoTableCard
              eyebrow="POR CIDADE &amp; FILIAL"
              title="Cidades com mais ativações"
              firstColumnHeader="CIDADE / FILIAL"
              rows={data.rankingCidades}
              loading={isLoading}
            />

            {/* Card 4: ORIGEM DO LEAD -> Ativações por origem de entrada */}
            <DesempenhoTableCard
              eyebrow="ORIGEM DO LEAD &amp; CANAL"
              title="Ativações por origem de entrada"
              firstColumnHeader="ORIGEM / CANAL"
              rows={data.origensLead.map((o) => ({
                name: o.name,
                qtd: o.qtd,
                percent: o.percent,
                ticketMedio: o.ticketMedio,
                valor: o.valor,
              }))}
              loading={isLoading}
            />
          </div>

          {/* Terceira Linha: Financiamento/Bancos & Síntese de Perdas */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card 5: MODALIDADE DE PAGAMENTO -> Donut de Financiamento */}
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
                    className="p-4 rounded-xl border border-[var(--voux-card-border)] bg-[var(--voux-surface)] hover:border-emerald-600/50 cursor-pointer transition-all"
                  >
                    <div className="flex items-center justify-between text-xs font-semibold text-[var(--voux-text-muted)]">
                      <span className="font-mono text-[14px] text-[var(--voux-text-primary)] font-bold">{res.ano}</span>
                      <span>{res.qtd} pedidos</span>
                    </div>
                    <p className="text-[18px] font-bold font-mono text-emerald-700 dark:text-emerald-400 mt-2">
                      {formatBRL(res.faturamento)}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-red-600 dark:text-red-400">
                    {formatBRL(data.kpis.valorPerdido)}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">
                    {formatBRL(ticketMedioPerda)}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {formatBRL(data.kpis.faturamento)}
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
                  <p className="text-[18px] md:text-[20px] font-bold font-mono text-amber-600 dark:text-amber-400">
                    {formatBRL(data.kpis.valorEmAndamento || data.kpis.pipelineAberto || 0)}
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

          {/* Grid de Tabelas de Diagnóstico de Perdas (Todos em Tema Vermelho Sólido) */}
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
              loading={isLoading}
            />
          </div>
        </div>
      )}
    </div>
  );
}
