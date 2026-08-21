import { useState, useMemo } from "react";
import { type DateRange } from "react-day-picker";
import {
  DollarSign,
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Target,
  XCircle,
  Trophy,
  Award,
} from "lucide-react";
import { toISODate, formatBRL } from "@/lib/dateUtils";
import { useDesempenhoVendas } from "@/hooks/bi/useDesempenhoVendas";
import { DesempenhoTableCard } from "@/components/bi/desempenho/DesempenhoTableCard";
import { DesempenhoDonutCard } from "@/components/bi/desempenho/DesempenhoDonutCard";
import { DesempenhoFilterBar } from "@/components/bi/desempenho/DesempenhoFilterBar";
import { Skeleton } from "@/components/ui/skeleton";

export default function BiDesempenhoVendas() {
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

  const { data, isLoading } = useDesempenhoVendas(filterOptions);

  // Lista de vendedores e cidades únicas para os selects
  const vendedorOptions = useMemo(() => {
    const set = new Set(data.rankingVendedores.map((v) => v.name));
    return Array.from(set).filter(Boolean);
  }, [data.rankingVendedores]);

  const cidadeOptions = useMemo(() => {
    const set = new Set(data.rankingCidades.map((c) => c.name));
    return Array.from(set).filter(Boolean);
  }, [data.rankingCidades]);

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

  return (
    <div className="p-5 md:p-8 space-y-6 max-w-[1600px] mx-auto">
      {/* Header Principal */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span
              className="text-[10px] font-bold tracking-[0.2em] uppercase px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
              style={{ fontFamily: "var(--voux-font-mono)" }}
            >
              NOVO DASHBOARD · VISÃO INTEGRADA
            </span>
          </div>
          <h1
            className="text-[24px] md:text-[28px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-1"
            style={{ fontFamily: "var(--voux-font-display)" }}
          >
            Desempenho de Vendas &amp; Resultados
          </h1>
          <p className="text-xs md:text-sm text-[var(--voux-text-muted)] mt-0.5">
            Métricas consolidadas por Vendedor, Produto, Região, Origem e Financiamento com cruzamento de dados.
          </p>
        </div>
      </div>

      {/* Barra de Filtros */}
      <DesempenhoFilterBar
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
      />

      {/* Ribbon de KPIs Principais */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 md:gap-4">
        {/* KPI 1: Faturamento Total */}
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ fontFamily: "var(--voux-font-mono)" }}>
              Faturamento
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
              <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Pedidos aprovados</p>
            </div>
          )}
        </div>

        {/* KPI 2: Quantidade de Pedidos */}
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ fontFamily: "var(--voux-font-mono)" }}>
              Vendas Concluídas
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
              <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Volume de ativações</p>
            </div>
          )}
        </div>

        {/* KPI 3: Ticket Médio Geral */}
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ fontFamily: "var(--voux-font-mono)" }}>
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
              <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">Valor médio por pedido</p>
            </div>
          )}
        </div>

        {/* KPI 4: % Financiado */}
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ fontFamily: "var(--voux-font-mono)" }}>
              % Financiado
            </span>
            <CreditCard className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-20 bg-[var(--voux-skeleton)]" />
          ) : (
            <div>
              <p className="text-[18px] md:text-[20px] font-bold font-mono text-[var(--voux-text-primary)]">
                {data.kpis.percentFinanciado.toFixed(1)}%
              </p>
              <p className="text-[10px] text-[var(--voux-text-muted)] mt-0.5">
                {formatBRL(data.kpis.valorFinanciado)} via banco
              </p>
            </div>
          )}
        </div>

        {/* KPI 5: Top Vendedor */}
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-4 shadow-sm">
          <div className="flex items-center justify-between text-[var(--voux-text-muted)] mb-1">
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ fontFamily: "var(--voux-font-mono)" }}>
              Líder em Vendas
            </span>
            <Trophy className="h-4 w-4 text-amber-500" />
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
          ) : topVendedor ? (
            <div>
              <p className="text-[14px] font-bold text-[var(--voux-text-primary)] truncate uppercase" title={topVendedor.name}>
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
            <span className="text-[10px] font-bold tracking-wider uppercase" style={{ fontFamily: "var(--voux-font-mono)" }}>
              Top Produto
            </span>
            <Award className="h-4 w-4 text-primary" />
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24 bg-[var(--voux-skeleton)]" />
          ) : topProduto ? (
            <div>
              <p className="text-[13px] font-bold text-[var(--voux-text-primary)] truncate" title={topProduto.name}>
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

      {/* Grid Principal 2x2 — Estrutura Idêntica ao Mock de Referência */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 1: POR VENDEDOR -> Quem vende mais */}
        <DesempenhoTableCard
          eyebrow="POR VENDEDOR"
          title="Quem vende mais"
          firstColumnHeader="VENDEDOR"
          rows={data.rankingVendedores}
          loading={isLoading}
          maxDisplayRows={8}
        />

        {/* Card 2: POR PLANO / PRODUTO -> Planos e Produtos mais vendidos */}
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
          maxDisplayRows={8}
        />

        {/* Card 3: POR BAIRRO / CIDADE -> Bairros e Cidades com mais ativações */}
        <DesempenhoTableCard
          eyebrow="POR CIDADE &amp; FILIAL"
          title="Cidades com mais ativações"
          firstColumnHeader="CIDADE / FILIAL"
          rows={data.rankingCidades}
          loading={isLoading}
          maxDisplayRows={8}
        />

        {/* Card 4: TIPO DE PESSOA / ORIGEM -> Ativações por tipo de pessoa / Origem */}
        <DesempenhoDonutCard
          eyebrow="ORIGEM DO LEAD &amp; CANAL"
          title="Ativações por origem de entrada"
          items={data.origensLead.map((o) => ({
            name: o.name,
            qtd: o.qtdGanhos || o.qtd,
            valor: o.valor,
            percent: o.percent,
          }))}
          loading={isLoading}
        />
      </div>

      {/* Segunda Linha: Financiamento/Bancos & Perdas/Concorrência */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Card 5: MODALIDADE DE PAGAMENTO -> Bancos Financiadores */}
        <DesempenhoDonutCard
          eyebrow="MODALIDADE &amp; BANCOS"
          title="Vendas por instituição financeira"
          items={data.financiamentoBancos.map((b) => ({
            name: b.name,
            qtd: b.qtd,
            valor: b.valor,
            percent: b.percent,
          }))}
          loading={isLoading}
        />

        {/* Card 6: MOTIVOS DE PERDA & CONCORRENTES */}
        <DesempenhoTableCard
          eyebrow="INTELIGÊNCIA COMPETITIVA"
          title="Motivos de perda &amp; concorrentes"
          firstColumnHeader="MOTIVO / CONCORRENTE"
          rows={data.motivosPerda.map((m) => ({
            name: m.name,
            subtitle: m.concorrenteTop ? `Concorrente: ${m.concorrenteTop}` : undefined,
            qtd: m.qtd,
            percent: m.percent,
            ticketMedio: m.qtd > 0 ? m.valor / m.qtd : 0,
            valor: m.valor,
          }))}
          loading={isLoading}
          maxDisplayRows={6}
        />
      </div>

      {/* Resumo Histórico Anual */}
      {data.resumoAnual.length > 0 && (
        <div className="rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm">
          <div className="mb-4">
            <p
              className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
              style={{ fontFamily: "var(--voux-font-mono)" }}
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
  );
}
