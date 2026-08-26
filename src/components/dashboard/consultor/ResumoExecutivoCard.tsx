import { useMemo, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Users, ShoppingBag, CalendarCheck, Target, TrendingUp, DollarSign } from "lucide-react";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";
import type { Filters } from "@/types/comercial";
import { fetchMetaAnual } from "@/services/metasService";
import { cn } from "@/lib/utils";

interface ResumoExecutivoCardProps {
  resumo: RpcConsultorResumoAcoes[];
  desempenho?: EquipeDesempenhoData;
  anoDesempenho?: number;
  filters?: Filters;
}

const BRL_EXACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const PCT_EXACT = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatBRL(value: number | null | undefined): string {
  if (value == null) return "R$ 0,00";
  return BRL_EXACT.format(Number(value));
}

function formatPct(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(Number(value))) return "0,0%";
  return `${PCT_EXACT.format(Number(value))}%`;
}

export const ResumoExecutivoCard = memo(function ResumoExecutivoCard({
  resumo,
  desempenho,
  anoDesempenho = new Date().getFullYear(),
  filters,
}: ResumoExecutivoCardProps) {
  // Query meta anual da empresa direto da tabela metas_comerciais
  const { data: metaAnualDb } = useQuery({
    queryKey: ["meta_anual_empresa", anoDesempenho],
    queryFn: () => fetchMetaAnual(anoDesempenho),
    staleTime: 1000 * 60 * 5,
  });

  // Competência do mês atual
  const compAtual = useMemo(() => {
    if (filters?.dateRange?.from) {
      return `${filters.dateRange.from.slice(0, 7)}-01`;
    }
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  }, [filters?.dateRange]);

  // Totais do Período a partir do resumo e desempenho
  const totais = useMemo(() => {
    let totalVendidoPeriodo = 0;
    let totalGanhosPeriodo = 0;
    let totalAcoes = 0;
    let totalVisitas = 0;
    let totalClientes = 0;
    let totalPipeline = 0;

    for (let i = 0; i < resumo.length; i++) {
      const item = resumo[i];
      totalVendidoPeriodo += Number(item.valor_ganho || 0);
      totalGanhosPeriodo += Number(item.ganhos || 0);
      totalAcoes += Number(item.acoes || 0);
      totalVisitas += Number(item.visitas || 0);
      totalClientes += Number(item.clientes || 0);
      totalPipeline += Number(item.pipeline_aberto_gerado || 0);
    }

    // Totais acumulados do ano a partir de desempenho.team
    const teamRows = desempenho?.team ?? [];
    const totalVendidoAno = teamRows.reduce((sum, t) => sum + Number(t.total_venda || 0), 0);
    const totalGanhosAno = teamRows.reduce((sum, t) => sum + Number(t.quantidade_vendas || 0), 0);
    const metaAnoCalculada = teamRows.reduce((sum, t) => sum + Number(t.meta || 0), 0);
    const metaAnualEmpresa = metaAnualDb != null && metaAnualDb > 0 ? metaAnualDb : metaAnoCalculada;

    const rowMesAtualTeam = teamRows.find((t) => t.competencia === compAtual);
    const metaMesAtual = Number(rowMesAtualTeam?.meta || 0);
    const vendidoMesAtual = Number(rowMesAtualTeam?.total_venda || totalVendidoPeriodo);

    const saldoMetaAno = Math.max(metaAnualEmpresa - totalVendidoAno, 0);
    const pctMetaAno = metaAnualEmpresa > 0 ? (totalVendidoAno / metaAnualEmpresa) * 100 : 0;

    const saldoMetaMes = Math.max(metaMesAtual - vendidoMesAtual, 0);
    const pctMetaMes = metaMesAtual > 0 ? (vendidoMesAtual / metaMesAtual) * 100 : 0;

    return {
      totalVendidoPeriodo,
      totalGanhosPeriodo,
      totalAcoes,
      totalVisitas,
      totalClientes,
      totalPipeline,
      metaAnualEmpresa,
      totalVendidoAno,
      totalGanhosAno,
      saldoMetaAno,
      pctMetaAno,
      metaMesAtual,
      vendidoMesAtual,
      saldoMetaMes,
      pctMetaMes,
    };
  }, [resumo, desempenho, metaAnualDb, compAtual]);

  const percentualAnoBar = Math.min(Math.max(totais.pctMetaAno, 0), 100);

  return (
    <div
      className="flex flex-col justify-between h-full rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <div>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 mb-3.5">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-amber-500 dark:text-amber-400" />
            <h3
              className="text-[12px] font-semibold uppercase tracking-[0.12em]"
              style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
            >
              Resumo Executivo · Meta da Empresa {anoDesempenho}
            </h3>
          </div>
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-background">
            {resumo.length} consultores
          </span>
        </div>

        {/* HEADLINE PRINCIPAL: META ANUAL DA EMPRESA */}
        <div className="mb-4 rounded-xl border p-3.5 bg-black/[0.02] dark:bg-white/[0.02]" style={{ borderColor: "var(--voux-card-border)" }}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-semibold text-muted-foreground uppercase font-mono tracking-wider">
              Meta Anual da Empresa
            </span>
            <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[12px]">
              {formatPct(totais.pctMetaAno)} atingido
            </span>
          </div>

          <p
            className="text-2xl lg:text-3xl font-bold tracking-tight tabular-nums"
            style={{ fontFamily: "var(--voux-font-display)", color: "var(--voux-text-heading)" }}
          >
            {formatBRL(totais.metaAnualEmpresa)}
          </p>

          <div className="flex items-center justify-between text-[11px] mt-1.5 mb-2" style={{ color: "var(--voux-text-faint)" }}>
            <span className="font-mono font-medium text-emerald-600 dark:text-emerald-400">
              Faturado no Ano: <strong>{formatBRL(totais.totalVendidoAno)}</strong>
            </span>
            <span className="font-mono text-rose-500">
              Falta: <strong>{formatBRL(totais.saldoMetaAno)}</strong>
            </span>
          </div>

          {/* Accent Gold/Champagne Progress Bar */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
            <div
              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500"
              style={{ width: `${percentualAnoBar}%` }}
            />
          </div>
        </div>

        {/* BLOCO INFERIOR: TOTAL FATURADO NO PERÍODO & META DO MÊS */}
        <div className="mb-4 rounded-xl border p-3 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span className="font-semibold text-muted-foreground font-mono flex items-center gap-1">
              <DollarSign className="h-3.5 w-3.5 text-emerald-500" />
              Faturado no Período Selecionado
            </span>
            <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
              {totais.totalGanhosPeriodo} pedidos ganhos
            </span>
          </div>

          <p className="font-mono font-bold text-[18px] text-emerald-600 dark:text-emerald-400 tabular-nums">
            {formatBRL(totais.totalVendidoPeriodo)}
          </p>

          {totais.metaMesAtual > 0 && (
            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mt-1 pt-1.5 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
              <span>Meta do Mês: <strong className="text-foreground">{formatBRL(totais.metaMesAtual)}</strong></span>
              <span>Falta no Mês: <strong className="text-rose-500">{formatBRL(totais.saldoMetaMes)}</strong> ({formatPct(totais.pctMetaMes)})</span>
            </div>
          )}
        </div>

        {/* Sub-KPIs Strip with Mini Bars */}
        <div className="space-y-3 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
          {/* Clientes Únicos */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <Users className="h-3.5 w-3.5 text-sky-500" />
                Clientes atendidos no período
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                {totais.totalClientes.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-sky-500" style={{ width: "85%" }} />
            </div>
          </div>

          {/* Vendas Fechadas (Ganhos) */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
                Deals fechados no período
              </span>
              <span className="font-mono font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                {totais.totalGanhosPeriodo.toLocaleString("pt-BR")}
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-emerald-500" style={{ width: "90%" }} />
            </div>
          </div>

          {/* Ações & Visitas */}
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="flex items-center gap-1.5 font-medium" style={{ color: "var(--voux-text-primary)" }}>
                <CalendarCheck className="h-3.5 w-3.5 text-purple-500" />
                Ações de campo & visitas
              </span>
              <span className="font-mono font-bold tabular-nums" style={{ color: "var(--voux-text-heading)" }}>
                {totais.totalAcoes.toLocaleString("pt-BR")}{" "}
                <span className="text-[10px] font-normal text-muted-foreground">({totais.totalVisitas} vis.)</span>
              </span>
            </div>
            <div className="h-1 w-full overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div className="h-full rounded-full bg-purple-500" style={{ width: "75%" }} />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 mt-3 border-t text-[10px] font-mono text-muted-foreground flex items-center justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
        <span>Metas sincronizadas em tempo real</span>
        <span className="text-amber-500">Ano {anoDesempenho}</span>
      </div>
    </div>
  );
});
