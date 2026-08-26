import { useState, useMemo, memo } from "react";
import {
  Trophy,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Target,
  Briefcase,
  Users,
  Compass,
  CheckCircle2,
  AlertCircle,
  Clock,
  Sparkles,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Vendedor, Filters } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";
import { AvatarPersona } from "@/components/ui/AvatarPersona";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface RankingPerformanceCardsProps {
  vendedores: Vendedor[];
  resumo: RpcConsultorResumoAcoes[];
  desempenho: EquipeDesempenhoData;
  filters: Filters;
  onSelectConsultor: (nome: string) => void;
}

type SortOption = "vendas" | "meta" | "pipeline" | "visitas" | "conversao" | "nome";
type FilterStatus = "todos" | "meta_batida" | "em_rota" | "abaixo" | "com_vendas";

const BRL_COMPACT = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 1,
});

const BRL_FULL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const PCT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

function formatCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return "R$ 0";
  const num = Number(value);
  if (Math.abs(num) >= 1e6) {
    return `R$ ${(num / 1e6).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} mi`;
  }
  if (Math.abs(num) >= 1e3) {
    return `R$ ${(num / 1e3).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} mil`;
  }
  return BRL_FULL.format(num);
}

function formatFullCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return "R$ 0";
  return BRL_FULL.format(Number(value));
}

function formatPct(value: number | null | undefined): string {
  if (value == null) return "—";
  return `${PCT_FORMATTER.format(Number(value))}%`;
}

function formatRatio(value: number | null | undefined, unit: string): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${PCT_FORMATTER.format(value)} ${unit}`;
}

const POSITION_RIBBONS = [
  {
    bg: "bg-amber-500 text-amber-950 font-black border-amber-400 shadow-amber-500/20",
    glow: "border-amber-500/40 shadow-[0_0_15px_-3px_rgba(245,158,11,0.15)]",
    trophy: "text-amber-500",
  },
  {
    bg: "bg-slate-300 text-slate-900 font-black border-slate-200 shadow-slate-300/20",
    glow: "border-slate-400/30 shadow-[0_0_15px_-3px_rgba(148,163,184,0.15)]",
    trophy: "text-slate-400",
  },
  {
    bg: "bg-amber-700 text-amber-100 font-black border-amber-600 shadow-amber-700/20",
    glow: "border-amber-700/30 shadow-[0_0_15px_-3px_rgba(180,83,9,0.15)]",
    trophy: "text-amber-700",
  },
];

export const RankingPerformanceCards = memo(function RankingPerformanceCards({
  vendedores,
  resumo,
  desempenho,
  filters,
  onSelectConsultor,
}: RankingPerformanceCardsProps) {
  const [busca, setBusca] = useState("");
  const [ordenacao, setOrdenacao] = useState<SortOption>("vendas");
  const [filtroStatus, setFiltroStatus] = useState<FilterStatus>("todos");
  const [expandido, setExpandido] = useState(false);

  const resumoPorConsultor = useMemo(
    () => new Map(resumo.map((item) => [item.consultor, item])),
    [resumo]
  );

  // Determinar competência atual e mês anterior
  const { compAtual, compAnterior } = useMemo(() => {
    let ym = "";
    if (filters.dateRange?.from) {
      ym = filters.dateRange.from.slice(0, 7);
    } else {
      const now = new Date();
      ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    }
    const current = `${ym}-01`;

    const [yearStr, monthStr] = ym.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const prevDate = new Date(y, m - 2, 1);
    const prevYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const previous = `${prevYm}-01`;

    return { compAtual: current, compAnterior: previous };
  }, [filters.dateRange]);

  // Consolidar dados de cada consultor
  const consultoresProcessados = useMemo(() => {
    const rowsAtualMap = new Map<string, typeof desempenho.rows[0]>();
    const rowsAnteriorMap = new Map<string, typeof desempenho.rows[0]>();

    for (const r of desempenho.rows) {
      if (!r.consultor) continue;
      if (r.competencia === compAtual) {
        rowsAtualMap.set(r.consultor, r);
      } else if (r.competencia === compAnterior) {
        rowsAnteriorMap.set(r.consultor, r);
      }
    }

    return vendedores.map((v) => {
      const rAtual = rowsAtualMap.get(v.nome);
      const rAnterior = rowsAnteriorMap.get(v.nome);
      const res = resumoPorConsultor.get(v.nome);

      const vendaAtual = Number(res?.valor_ganho ?? rAtual?.total_venda ?? 0);
      const vendaAnterior = Number(rAnterior?.total_venda ?? 0);
      const deltaVenda =
        vendaAnterior > 0 ? ((vendaAtual - vendaAnterior) / vendaAnterior) * 100 : null;

      const metaMes = Number(rAtual?.meta ?? 0);
      const desempenhoMeta =
        metaMes > 0 ? (vendaAtual / metaMes) * 100 : rAtual?.desempenho_meta != null ? Number(rAtual.desempenho_meta) : null;
      const saldoMeta = metaMes - vendaAtual;

      const oportunidade = Number(rAtual?.oportunidade ?? 0);
      const cotacao = Number(rAtual?.cotacao ?? 0);
      const proposta = Number(rAtual?.proposta ?? 0);
      const totalPipeline =
        Number(rAtual?.total ?? 0) > 0
          ? Number(rAtual?.total)
          : oportunidade + cotacao + proposta > 0
          ? oportunidade + cotacao + proposta
          : Number(res?.carteira_ativa_trabalhada ?? 0);

      const quantidadeVendas = Number(res?.ganhos ?? rAtual?.quantidade_vendas ?? 0);
      const ticketMedio =
        rAtual?.ticket_medio != null
          ? Number(rAtual.ticket_medio)
          : quantidadeVendas > 0 && vendaAtual > 0
          ? vendaAtual / quantidadeVendas
          : null;

      const taxaConversao =
        rAtual?.taxa_conversao_negocios != null
          ? Number(rAtual.taxa_conversao_negocios)
          : res?.taxa_ganho != null
          ? Number(res.taxa_ganho)
          : null;

      const visitas = Number(res?.visitas ?? v.visitas ?? 0);
      const clientes = Number(res?.clientes ?? rAtual?.clientes ?? v.clientes ?? 0);
      const oportunidadesQtd = Number(res?.oportunidades_geradas ?? rAtual?.negocios ?? 0);

      const visitasPorOportunidade =
        oportunidadesQtd > 0 && visitas > 0 ? visitas / oportunidadesQtd : null;
      const clientesPorVenda =
        quantidadeVendas > 0 && clientes > 0 ? clientes / quantidadeVendas : null;
      const visitasPorVenda =
        quantidadeVendas > 0 && visitas > 0 ? visitas / quantidadeVendas : null;

      const crmQuality = res?.crm_quality ?? v.crmQuality ?? 0;

      return {
        nome: v.nome,
        vendaAtual,
        vendaAnterior,
        deltaVenda,
        metaMes,
        desempenhoMeta,
        saldoMeta,
        oportunidade,
        cotacao,
        proposta,
        totalPipeline,
        quantidadeVendas,
        ticketMedio,
        taxaConversao,
        visitas,
        clientes,
        oportunidadesQtd,
        visitasPorOportunidade,
        clientesPorVenda,
        visitasPorVenda,
        crmQuality,
        totalAcoes: v.totalAcoes,
      };
    });
  }, [vendedores, desempenho.rows, resumoPorConsultor, compAtual, compAnterior]);

  // Ordenação
  const consultoresOrdenados = useMemo(() => {
    return [...consultoresProcessados].sort((a, b) => {
      switch (ordenacao) {
        case "vendas":
          return b.vendaAtual - a.vendaAtual || (b.desempenhoMeta ?? 0) - (a.desempenhoMeta ?? 0);
        case "meta":
          return (b.desempenhoMeta ?? -1) - (a.desempenhoMeta ?? -1) || b.vendaAtual - a.vendaAtual;
        case "pipeline":
          return b.totalPipeline - a.totalPipeline || b.vendaAtual - a.vendaAtual;
        case "visitas":
          return b.visitas - a.visitas || b.vendaAtual - a.vendaAtual;
        case "conversao":
          return (b.taxaConversao ?? -1) - (a.taxaConversao ?? -1) || b.vendaAtual - a.vendaAtual;
        case "nome":
          return a.nome.localeCompare(b.nome, "pt-BR");
        default:
          return b.vendaAtual - a.vendaAtual;
      }
    });
  }, [consultoresProcessados, ordenacao]);

  // Filtros de busca e status
  const consultoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return consultoresOrdenados.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q)) return false;

      switch (filtroStatus) {
        case "meta_batida":
          return c.desempenhoMeta != null && c.desempenhoMeta >= 100;
        case "em_rota":
          return c.desempenhoMeta != null && c.desempenhoMeta >= 70 && c.desempenhoMeta < 100;
        case "abaixo":
          return c.desempenhoMeta != null && c.desempenhoMeta < 70 && c.metaMes > 0;
        case "com_vendas":
          return c.vendaAtual > 0;
        default:
          return true;
      }
    });
  }, [consultoresOrdenados, busca, filtroStatus]);

  const cardsVisiveis = expandido ? consultoresFiltrados : consultoresFiltrados.slice(0, 6);

  if (consultoresProcessados.length === 0) return null;

  return (
    <div
      className="space-y-4 rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      {/* Header com Título, Busca e Filtros */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "var(--voux-card-border)" }}>
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-600 dark:text-amber-400">
            <Trophy className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-[14px] font-bold text-foreground" style={{ fontFamily: "var(--voux-font-sans)" }}>
                Performance Ranking · Cartões dos Consultores
              </h3>
              <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-mono text-muted-foreground bg-background">
                {consultoresFiltrados.length} de {consultoresProcessados.length} consultores
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dossiê 360° com metas, pipeline ativo, eficiência comercial e esforço de campo
            </p>
          </div>
        </div>

        {/* Controles: Busca e Ordenação */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] max-w-[260px]">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar consultor…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="h-8 pl-8 text-[11px]"
            />
          </div>

          <select
            value={ordenacao}
            onChange={(e) => setOrdenacao(e.target.value as SortOption)}
            className="h-8 rounded-md border bg-background px-2.5 text-[11px] font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-amber-500"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <option value="vendas">Maior Venda Realizada</option>
            <option value="meta">Maior % da Meta</option>
            <option value="pipeline">Maior Pipeline Ativo</option>
            <option value="visitas">Mais Visitas no Mês</option>
            <option value="conversao">Maior Taxa de Conversão</option>
            <option value="nome">Nome (A-Z)</option>
          </select>
        </div>
      </div>

      {/* Chips de Filtro Rápido */}
      <div className="flex flex-wrap items-center gap-1.5 pt-1">
        {[
          { id: "todos", label: "Todos" },
          { id: "meta_batida", label: "🏆 Meta Batida (≥100%)" },
          { id: "em_rota", label: "⚡ Em Rota (70%–99%)" },
          { id: "abaixo", label: "⚠️ Abaixo (<70%)" },
          { id: "com_vendas", label: "💰 Com Vendas" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroStatus(f.id as FilterStatus)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-all",
              filtroStatus === f.id
                ? "bg-amber-500 text-amber-950 font-bold shadow-sm"
                : "border bg-black/[0.02] dark:bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-black/[0.05]"
            )}
            style={{
              borderColor: filtroStatus === f.id ? "transparent" : "var(--voux-card-border)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Grid de Cartões dos Consultores */}
      {consultoresFiltrados.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center" style={{ borderColor: "var(--voux-card-border)" }}>
          <p className="text-sm text-muted-foreground">Nenhum consultor encontrado para os filtros selecionados.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cardsVisiveis.map((c, index) => {
            const ribbon = POSITION_RIBBONS[index];
            const percentMeta = c.desempenhoMeta != null ? Math.min(Math.max(c.desempenhoMeta, 0), 100) : 0;
            const isTop3 = index < 3 && ordenacao === "vendas";
            const metaSuperada = c.desempenhoMeta != null && c.desempenhoMeta >= 100;
            const emRota = c.desempenhoMeta != null && c.desempenhoMeta >= 70 && c.desempenhoMeta < 100;

            const crmBadge =
              c.crmQuality >= 70
                ? { label: "Nota A", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" }
                : c.crmQuality >= 50
                ? { label: "Nota B", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" }
                : { label: "Nota C", bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };

            return (
              <div
                key={c.nome}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300",
                  "hover:shadow-xl hover:scale-[1.01]",
                  ribbon?.glow ?? "border-[var(--voux-card-border)]"
                )}
                style={{
                  background: "var(--surface-raised)",
                  borderColor: isTop3 ? ribbon?.glow : "var(--voux-card-border)",
                  boxShadow: "var(--voux-card-shadow)",
                }}
              >
                {/* Top Section: Avatar, Nome, Posição & Badges */}
                <div>
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <AvatarPersona
                          name={c.nome}
                          size="md"
                          className="shadow-md ring-2 ring-black/5 dark:ring-white/10 group-hover:scale-105 transition-transform"
                        />
                        {isTop3 && (
                          <span
                            className={cn(
                              "absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border text-[9px] font-mono",
                              ribbon.bg
                            )}
                          >
                            {index + 1}
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <h4
                            className="truncate text-[13px] font-bold text-foreground group-hover:text-amber-500 transition-colors cursor-pointer"
                            onClick={() => onSelectConsultor(c.nome)}
                            title={c.nome}
                          >
                            {c.nome}
                          </h4>
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          {c.totalAcoes} ações registradas · CRM {crmBadge.label}
                        </p>
                      </div>
                    </div>

                    {/* Meta Badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {c.desempenhoMeta != null && c.metaMes > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border tabular-nums",
                            metaSuperada
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : emRota
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          )}
                        >
                          {metaSuperada ? <CheckCircle2 className="h-3 w-3" /> : emRota ? <Sparkles className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                          {formatPct(c.desempenhoMeta)}
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-muted-foreground border border-black/5 dark:border-white/10">
                          Sem meta
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bloco 1: Meta & Vendas (Mês Atual vs Passado) */}
                  <div className="mb-3 rounded-xl border p-3 bg-black/[0.02] dark:bg-white/[0.02]" style={{ borderColor: "var(--voux-card-border)" }}>
                    <div className="flex items-center justify-between text-[11px] mb-1.5">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1">
                        <Target className="h-3.5 w-3.5 text-amber-500" />
                        Meta do Mês: <strong className="font-mono text-foreground">{formatCurrency(c.metaMes)}</strong>
                      </span>
                      {c.saldoMeta > 0 && c.metaMes > 0 ? (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Falta: <strong className="text-rose-500">{formatCurrency(c.saldoMeta)}</strong>
                        </span>
                      ) : c.metaMes > 0 ? (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                          Meta Superada!
                        </span>
                      ) : null}
                    </div>

                    {/* Barra de Progresso da Meta */}
                    {c.metaMes > 0 && (
                      <div className="mb-2.5 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                        <div
                          className={cn(
                            "h-full rounded-full transition-all duration-500",
                            metaSuperada
                              ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                              : emRota
                              ? "bg-gradient-to-r from-amber-500 to-emerald-500"
                              : "bg-gradient-to-r from-rose-500 to-amber-500"
                          )}
                          style={{ width: `${percentMeta}%` }}
                        />
                      </div>
                    )}

                    {/* Venda Atual vs Mês Passado */}
                    <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                      <div>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Vendido no Mês</p>
                        <p className="font-mono font-bold text-[14px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                          {formatFullCurrency(c.vendaAtual)}
                        </p>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {c.quantidadeVendas} {c.quantidadeVendas === 1 ? "venda" : "vendas"}
                        </p>
                      </div>

                      <div className="border-l pl-2" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Mês Passado</p>
                        <div className="flex items-center gap-1">
                          <p className="font-mono font-semibold text-[12px] text-foreground tabular-nums">
                            {formatCurrency(c.vendaAnterior)}
                          </p>
                          {c.deltaVenda != null && (
                            <span
                              className={cn(
                                "flex items-center text-[10px] font-mono font-bold",
                                c.deltaVenda >= 0 ? "text-emerald-500" : "text-rose-500"
                              )}
                            >
                              {c.deltaVenda >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {Math.abs(c.deltaVenda).toFixed(0)}%
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] font-mono text-muted-foreground">
                          {c.deltaVenda != null && c.deltaVenda >= 0 ? "em alta vs anterior" : "comparativo mensal"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 2: Pipeline em Aberto (Três Mini-Cards) */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-[11px] mb-1.5 px-0.5">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 text-blue-500" />
                        Pipeline Ativo
                      </span>
                      <span className="font-mono font-bold text-foreground text-[11px]">
                        Total: {formatCurrency(c.totalPipeline)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Oportunidade */}
                      <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground truncate font-mono">1. Oport.</p>
                        <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                          {formatCurrency(c.oportunidade)}
                        </p>
                      </div>

                      {/* Cotação */}
                      <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground truncate font-mono">2. Cotação</p>
                        <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                          {formatCurrency(c.cotacao)}
                        </p>
                      </div>

                      {/* Proposta */}
                      <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground truncate font-mono">3. Proposta</p>
                        <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                          {formatCurrency(c.proposta)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Bloco 3: Atributos de Eficiência Comercial & Esforço de Campo (Grid 2x2) */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {/* Ticket Médio */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono">Ticket Médio</p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {formatCurrency(c.ticketMedio)}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">por pedido ganho</p>
                    </div>

                    {/* Taxa de Conversão */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono">Tx. Conversão</p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {formatPct(c.taxaConversao)}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                        {c.quantidadeVendas} vda / {c.oportunidadesQtd} neg
                      </p>
                    </div>

                    {/* Visitas no Mês */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Compass className="h-3 w-3 text-amber-500" />
                        Visitas no Mês
                      </p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {c.visitas} <span className="text-[10px] font-normal text-muted-foreground">visitas</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                        {formatRatio(c.visitasPorOportunidade, "vis/oport.")}
                      </p>
                    </div>

                    {/* Clientes Únicos */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Users className="h-3 w-3 text-emerald-500" />
                        Clientes Únicos
                      </p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {c.clientes} <span className="text-[10px] font-normal text-muted-foreground">clientes</span>
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                        {formatRatio(c.clientesPorVenda, "cli/venda")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer do Card / Ação */}
                <div className="mt-3.5 pt-2.5 border-t flex items-center justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Posição #{index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSelectConsultor(c.nome)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 hover:underline group-hover:translate-x-0.5 transition-transform"
                  >
                    Ver Dossiê Completo
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Botão para Expandir / Mostrar Todos os Consultores */}
      {consultoresFiltrados.length > 6 && (
        <div className="flex justify-center pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpandido(!expandido)}
            className="gap-2 text-[12px] font-mono border hover:bg-amber-500/10 hover:text-amber-500"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            {expandido ? (
              <>
                <ChevronUp className="h-3.5 w-3.5" />
                Mostrar apenas os 6 primeiros
              </>
            ) : (
              <>
                <ChevronDown className="h-3.5 w-3.5" />
                Ver todos os {consultoresFiltrados.length} cartões de consultores
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
});
