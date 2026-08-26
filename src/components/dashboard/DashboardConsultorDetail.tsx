import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Target,
  Calendar,
  Briefcase,
  Users,
  Compass,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Package,
} from "lucide-react";
import type { Vendedor, Registro } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";
import { Button } from "@/components/ui/button";
import { AvatarPersona } from "@/components/ui/AvatarPersona";
import { InsightConsultorCard } from "./consultor/InsightConsultorCard";
import { ConsultorClienteCard } from "./consultor/ConsultorClienteCard";
import { ConsultorNegociosPipelineCard } from "./consultor/ConsultorNegociosPipelineCard";
import { ConsultorDistribuicaoCampoCard } from "./consultor/ConsultorDistribuicaoCampoCard";
import { ChartCard } from "@/components/bi/ChartCard";
import { LineChart } from "@/components/bi/charts";
import EvolucaoGPOChart from "@/components/bi/charts/EvolucaoGPOChart";
import { useEvolucaoGPO } from "@/hooks/useEvolucaoGPO";
import { formatMonthYear } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

interface Props {
  vendedor: Vendedor;
  resumo: RpcConsultorResumoAcoes;
  desempenho?: EquipeDesempenhoData;
  anoDesempenho?: number;
  registros: Registro[];
  from: string;
  to: string;
  onBack: () => void;
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
  if (value == null || !Number.isFinite(Number(value))) return "—";
  return `${PCT_EXACT.format(Number(value))}%`;
}

function formatRatio(value: number | null | undefined, unit: string): string {
  if (value == null || !Number.isFinite(value) || value <= 0) return "—";
  return `${PCT_EXACT.format(value)} ${unit}`;
}

const EARTHY = ["#c97565", "#d4a05a", "#8ea3b8", "#7a9b6f", "#4caf7a", "#6e542f", "#d4b896"] as const;

// Donut interativo por tipo de ação
function SimpleDonut({ data, size = 135, thickness = 14 }: { data: { label: string; value: number; color: string }[]; size?: number; thickness?: number }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return null;
  const cx = size / 2;
  const cy = size / 2;
  const r = (size - thickness) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs = data.map((d) => {
    const pct = d.value / total;
    const dashArray = `${pct * circumference} ${circumference}`;
    const dashOffset = -offset * circumference;
    offset += pct;
    return { ...d, dashArray, dashOffset, pct };
  });

  const centerLabel = hovered !== null ? `${(arcs[hovered].pct * 100).toFixed(0)}%` : String(total);

  return (
    <div className="flex items-center gap-4">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 cursor-pointer">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(214,207,193,0.1)" strokeWidth={thickness} />
        {arcs.map((arc, i) => (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={arc.color}
            strokeWidth={hovered === i ? thickness + 4 : thickness}
            strokeDasharray={arc.dashArray}
            strokeDashoffset={arc.dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${cx} ${cy})`}
            opacity={hovered === null || hovered === i ? 1 : 0.4}
            className="transition-all duration-200"
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered(null)}
          />
        ))}
        <text
          x={cx}
          y={cy - 6}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--voux-font-mono)", fontSize: 16, fontWeight: 700, fill: "var(--voux-text-primary)" }}
        >
          {centerLabel}
        </text>
        <text
          x={cx}
          y={cy + 10}
          textAnchor="middle"
          dominantBaseline="central"
          style={{ fontFamily: "var(--voux-font-mono)", fontSize: 10, fill: "var(--voux-text-faint)" }}
        >
          ações
        </text>
      </svg>
      <div className="space-y-1.5 min-w-0 flex-1">
        {data.slice(0, 5).map((d, i) => {
          const pct = total > 0 ? ((d.value / total) * 100).toFixed(0) : "0";
          const isActive = hovered === i;
          return (
            <div
              key={d.label}
              className="flex items-center gap-1.5 py-0.5 px-1.5 rounded text-[11px] transition-colors cursor-default"
              style={{ background: isActive ? "rgba(214,207,193,0.08)" : "transparent" }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
              <span className="truncate text-muted-foreground">{d.label}</span>
              <span className="ml-auto font-mono font-bold tabular-nums text-foreground">{d.value}</span>
              <span className="text-[10px] font-mono text-muted-foreground">({pct}%)</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const DashboardConsultorDetail = ({
  vendedor: v,
  resumo,
  desempenho,
  anoDesempenho = new Date().getFullYear(),
  registros,
  from,
  to,
  onBack,
}: Props) => {
  const { data: gpoData, isLoading: gpoLoading } = useEvolucaoGPO({
    vendedor: v.nome,
    from: `${anoDesempenho}-01-01`,
    to: `${anoDesempenho}-12-31`,
    enabled: !!v.nome,
  });

  // Garantir que os gráficos mostrem exclusivamente os meses do ano corrente (2026)
  const evolucaoAno = useMemo(() => {
    return (v.evolucao ?? []).filter((d) => d.YearMonth.startsWith(String(anoDesempenho)));
  }, [v.evolucao, anoDesempenho]);

  const gpoDataAno = useMemo(() => {
    return (gpoData ?? []).filter((d) => d.mes.startsWith(String(anoDesempenho)));
  }, [gpoData, anoDesempenho]);

  // Competência Atual e Mês Anterior
  const { compAtual, compAnterior } = useMemo(() => {
    let ym = "";
    if (from) {
      ym = from.slice(0, 7);
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
  }, [from]);

  // Consolidar todos os dados e métricas exatas do consultor
  const consultorStats = useMemo(() => {
    const cRows = (desempenho?.rows ?? []).filter((r) => r.consultor === v.nome);
    const rAtual = cRows.find((r) => r.competencia === compAtual);
    const rAnterior = cRows.find((r) => r.competencia === compAnterior);

    // --- MÊS ATUAL ---
    const vendaMes = Number(rAtual?.total_venda ?? resumo.valor_ganho ?? 0);
    const vendaAnterior = Number(rAnterior?.total_venda ?? 0);
    const deltaVenda =
      vendaAnterior > 0 ? ((vendaMes - vendaAnterior) / vendaAnterior) * 100 : null;

    const metaMes = Number(rAtual?.meta ?? 0);
    const desempenhoMetaMes =
      metaMes > 0 ? (vendaMes / metaMes) * 100 : rAtual?.desempenho_meta != null ? Number(rAtual.desempenho_meta) : null;
    const saldoMetaMes = metaMes - vendaMes;

    // --- ACUMULADO DO ANO (YTD) ---
    const metaAno = cRows.reduce((sum, r) => sum + Number(r.meta ?? 0), 0);
    const vendaAno = cRows.reduce((sum, r) => sum + Number(r.total_venda ?? 0), 0);
    const saldoMetaAno = metaAno - vendaAno;
    const desempenhoMetaAno = metaAno > 0 ? (vendaAno / metaAno) * 100 : null;
    const quantidadeVendasAno = cRows.reduce((sum, r) => sum + Number(r.quantidade_vendas ?? 0), 0);
    const negociosAno = cRows.reduce((sum, r) => sum + Number(r.negocios ?? 0), 0);
    const ticketMedioAno =
      quantidadeVendasAno > 0 && vendaAno > 0 ? vendaAno / quantidadeVendasAno : null;

    // --- PIPELINE EM ABERTO ---
    const oportunidade = Number(rAtual?.oportunidade ?? 0);
    const cotacao = Number(rAtual?.cotacao ?? 0);
    const proposta = Number(rAtual?.proposta ?? 0);
    const totalPipeline =
      Number(rAtual?.total ?? 0) > 0
        ? Number(rAtual?.total)
        : oportunidade + cotacao + proposta > 0
        ? oportunidade + cotacao + proposta
        : Number(resumo.carteira_ativa_trabalhada ?? 0);

    // --- QUANTIDADES E MÉDIAS DO MÊS ---
    const quantidadeVendasMes = Number(rAtual?.quantidade_vendas ?? resumo.ganhos ?? 0);
    const oportunidadesAbertas = Number(rAtual?.oportunidades_abertas ?? 0);
    const negociosMes = Number(rAtual?.negocios ?? resumo.oportunidades_geradas ?? 0);

    const ticketMedioMes =
      rAtual?.ticket_medio != null
        ? Number(rAtual.ticket_medio)
        : quantidadeVendasMes > 0 && vendaMes > 0
        ? vendaMes / quantidadeVendasMes
        : null;

    const taxaConversaoMes =
      rAtual?.taxa_conversao_negocios != null
        ? Number(rAtual.taxa_conversao_negocios)
        : resumo.taxa_ganho != null
        ? Number(resumo.taxa_ganho)
        : null;

    // --- AÇÕES E ESFORÇO DE CAMPO ---
    const visitas = Number(resumo.visitas ?? v.visitas ?? 0);
    const clientes = Number(resumo.clientes ?? rAtual?.clientes ?? v.clientes ?? 0);

    const visitasPorOportunidade =
      negociosMes > 0 && visitas > 0 ? visitas / negociosMes : null;
    const clientesPorVenda =
      quantidadeVendasMes > 0 && clientes > 0 ? clientes / quantidadeVendasMes : null;
    const visitasPorVenda =
      quantidadeVendasMes > 0 && visitas > 0 ? visitas / quantidadeVendasMes : null;

    return {
      vendaMes,
      vendaAnterior,
      deltaVenda,
      metaMes,
      desempenhoMetaMes,
      saldoMetaMes,
      quantidadeVendasMes,
      ticketMedioMes,
      taxaConversaoMes,
      metaAno,
      vendaAno,
      saldoMetaAno,
      desempenhoMetaAno,
      quantidadeVendasAno,
      negociosAno,
      ticketMedioAno,
      oportunidade,
      cotacao,
      proposta,
      totalPipeline,
      oportunidadesAbertas,
      negociosMes,
      visitas,
      clientes,
      visitasPorOportunidade,
      clientesPorVenda,
      visitasPorVenda,
    };
  }, [v.nome, v.visitas, v.clientes, desempenho?.rows, resumo, compAtual, compAnterior]);

  const percentMetaMes = consultorStats.desempenhoMetaMes != null ? Math.min(Math.max(consultorStats.desempenhoMetaMes, 0), 100) : 0;
  const percentMetaAno = consultorStats.desempenhoMetaAno != null ? Math.min(Math.max(consultorStats.desempenhoMetaAno, 0), 100) : 0;
  const metaMesSuperada = consultorStats.desempenhoMetaMes != null && consultorStats.desempenhoMetaMes >= 100;
  const emRotaMes = consultorStats.desempenhoMetaMes != null && consultorStats.desempenhoMetaMes >= 70 && consultorStats.desempenhoMetaMes < 100;

  const crmBadge =
    v.crmQuality >= 70
      ? { label: "Nota A", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" }
      : v.crmQuality >= 50
      ? { label: "Nota B", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" }
      : { label: "Nota C", bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };

  const clientActions = useMemo(() => {
    const map = new Map<string, Registro[]>();
    const vendedorRegs = registros
      .filter((r) => r.vendedor === v.nome)
      .sort((a, b) => (b.dtConclusao || "").localeCompare(a.dtConclusao || ""));
    for (const r of vendedorRegs) {
      if (!map.has(r.cliente)) map.set(r.cliente, []);
      const arr = map.get(r.cliente)!;
      if (arr.length < 5) arr.push(r);
    }
    return map;
  }, [registros, v.nome]);

  const tiposAcaoData = Object.entries(v.tiposAcao || {})
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-[1920px] mx-auto">
      {/* Top Navigation & Profile Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4" style={{ borderColor: "var(--voux-card-border)" }}>
        <div className="flex items-center gap-3.5 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={onBack}
            className="rounded-xl h-9 w-9 shrink-0 border hover:bg-amber-500/10 hover:text-amber-500"
            style={{ borderColor: "var(--voux-card-border)" }}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>

          <div className="relative">
            <AvatarPersona
              name={v.nome}
              size="lg"
              className="shadow-lg ring-2 ring-black/5 dark:ring-white/10"
            />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2
                className="text-lg sm:text-xl font-bold tracking-tight text-foreground truncate"
                style={{ fontFamily: "var(--voux-font-display)" }}
              >
                {v.nome}
              </h2>
              <span className={cn("inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold border", crmBadge.bg)}>
                CRM {crmBadge.label} ({v.crmQuality}%)
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground font-mono">
              Dossiê individual 360° · {v.totalAcoes} ações registradas no período
            </p>
          </div>
        </div>

        {/* Badges de Meta no Header */}
        <div className="flex items-center gap-2 flex-wrap">
          {consultorStats.desempenhoMetaMes != null && (
            <span
              className={cn(
                "inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-mono font-bold border tabular-nums",
                metaMesSuperada
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : emRotaMes
                  ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              )}
            >
              {metaMesSuperada ? <CheckCircle2 className="h-3.5 w-3.5" /> : emRotaMes ? <Sparkles className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
              {formatPct(consultorStats.desempenhoMetaMes)} da Meta do Mês
            </span>
          )}

          {consultorStats.desempenhoMetaAno != null && (
            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-mono font-bold border bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 tabular-nums">
              <Calendar className="h-3.5 w-3.5" />
              {formatPct(consultorStats.desempenhoMetaAno)} da Meta Anual
            </span>
          )}
        </div>
      </div>

      {/* SEÇÃO 1: OS 4 CARDS DO DOSSIÊ 360° COM TIPOGRAFIA GRANDE E ORDEM INTUITIVA */}
      {/* Ordem: 1. Meta do Mês | 2. Pipeline Aberto | 3. Eficiência & Médias | 4. Meta Anual (Direita) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Meta do Mês & Vendas Realizadas */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-between transition-all"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--voux-card-border)",
            boxShadow: "var(--voux-card-shadow)",
          }}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-muted-foreground flex items-center gap-1 font-mono">
                <Target className="h-3.5 w-3.5 text-amber-500" />
                Meta do Mês
              </span>
              {consultorStats.saldoMetaMes > 0 && consultorStats.metaMes > 0 ? (
                <span className="text-[10px] font-mono text-rose-500 font-bold">
                  Falta: {formatBRL(consultorStats.saldoMetaMes)}
                </span>
              ) : consultorStats.metaMes > 0 ? (
                <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                  Meta Batida!
                </span>
              ) : null}
            </div>

            <p className="font-mono font-bold text-2xl text-foreground tabular-nums mb-2">
              {formatBRL(consultorStats.metaMes)}
            </p>

            {/* Barra de Progresso do Mês */}
            {consultorStats.metaMes > 0 && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className={cn(
                    "h-full rounded-full transition-all duration-500",
                    metaMesSuperada
                      ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                      : emRotaMes
                      ? "bg-gradient-to-r from-amber-500 to-emerald-500"
                      : "bg-gradient-to-r from-rose-500 to-amber-500"
                  )}
                  style={{ width: `${percentMetaMes}%` }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t text-[11px]" style={{ borderColor: "var(--voux-card-border)" }}>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Vendido no Mês</p>
              <p className="font-mono font-bold text-[15px] text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatBRL(consultorStats.vendaMes)}
              </p>
              <p className="text-[10px] font-mono text-muted-foreground">
                {consultorStats.quantidadeVendasMes} {consultorStats.quantidadeVendasMes === 1 ? "venda" : "vendas"}
              </p>
            </div>

            <div className="border-l pl-2" style={{ borderColor: "var(--voux-card-border)" }}>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Mês Passado</p>
              <p className="font-mono font-semibold text-[13px] text-foreground tabular-nums truncate">
                {formatBRL(consultorStats.vendaAnterior)}
              </p>
              {consultorStats.deltaVenda != null && (
                <p
                  className={cn(
                    "text-[10px] font-mono font-bold flex items-center gap-0.5",
                    consultorStats.deltaVenda >= 0 ? "text-emerald-500" : "text-rose-500"
                  )}
                >
                  {consultorStats.deltaVenda >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                  {Math.abs(consultorStats.deltaVenda).toFixed(0)}% vs anterior
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Card 2: Pipeline Aberto / Em Andamento */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-between transition-all"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--voux-card-border)",
            boxShadow: "var(--voux-card-shadow)",
          }}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-muted-foreground flex items-center gap-1 font-mono">
                <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                Pipeline Total Ativo
              </span>
              <span className="text-[10px] font-mono text-muted-foreground">
                {consultorStats.oportunidadesAbertas} em aberto
              </span>
            </div>

            <p className="font-mono font-bold text-2xl text-foreground tabular-nums mb-3">
              {formatBRL(consultorStats.totalPipeline)}
            </p>
          </div>

          <div className="grid grid-cols-3 gap-1.5 pt-2 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
            <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <p className="text-[9px] font-semibold uppercase text-muted-foreground font-mono truncate">1. Oport.</p>
              <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                {formatBRL(consultorStats.oportunidade)}
              </p>
            </div>

            <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <p className="text-[9px] font-semibold uppercase text-muted-foreground font-mono truncate">2. Cotação</p>
              <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                {formatBRL(consultorStats.cotacao)}
              </p>
            </div>

            <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
              <p className="text-[9px] font-semibold uppercase text-muted-foreground font-mono truncate">3. Prop.</p>
              <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                {formatBRL(consultorStats.proposta)}
              </p>
            </div>
          </div>
        </div>

        {/* Card 3: Ticket Médio & Taxa de Conversão */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-between transition-all"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--voux-card-border)",
            boxShadow: "var(--voux-card-shadow)",
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between text-[11px] mb-2 pb-1.5 border-b" style={{ borderColor: "var(--voux-card-border)" }}>
            <span className="font-semibold text-muted-foreground flex items-center gap-1 font-mono uppercase tracking-wider text-[10px]">
              <Compass className="h-3.5 w-3.5 text-emerald-500" />
              Eficiência Comercial
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">
              Médias do Consultor
            </span>
          </div>

          {/* Duas Metades com Números Grandes */}
          <div className="grid grid-cols-2 gap-3 divide-x my-auto" style={{ borderColor: "var(--voux-card-border)" }}>
            {/* Metade 1: Ticket Médio */}
            <div className="pr-1">
              <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground block mb-0.5">
                Ticket Médio
              </span>
              <p className="font-mono font-bold text-lg xl:text-xl text-foreground tabular-nums truncate">
                {formatBRL(consultorStats.ticketMedioMes ?? consultorStats.ticketMedioAno)}
              </p>
              <p className="text-[10px] font-mono text-amber-600 dark:text-amber-400 font-semibold mt-0.5 truncate">
                {formatRatio(consultorStats.visitasPorOportunidade, "vis/oport.")}
              </p>
            </div>

            {/* Metade 2: Taxa de Conversão */}
            <div className="pl-3">
              <span className="text-[10px] font-mono font-semibold uppercase text-muted-foreground block mb-0.5">
                Taxa Conversão
              </span>
              <p className="font-mono font-bold text-lg xl:text-xl text-emerald-600 dark:text-emerald-400 tabular-nums truncate">
                {formatPct(consultorStats.taxaConversaoMes)}
              </p>
              <p className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-semibold mt-0.5 truncate">
                {formatRatio(consultorStats.clientesPorVenda, "cli/venda")}
              </p>
            </div>
          </div>

          {/* Rodapé com Relação de Esforço */}
          <div className="grid grid-cols-2 gap-1.5 pt-2 mt-2 border-t text-[9px] font-mono text-muted-foreground" style={{ borderColor: "var(--voux-card-border)" }}>
            <span className="truncate">🎯 Esforço de Campo</span>
            <span className="text-right truncate">⚡ Fechamento</span>
          </div>
        </div>

        {/* Card 4 (Direita): Meta Anual & Acumulado YTD */}
        <div
          className="rounded-2xl border p-5 flex flex-col justify-between transition-all"
          style={{
            background: "var(--surface-raised)",
            borderColor: "var(--voux-card-border)",
            boxShadow: "var(--voux-card-shadow)",
          }}
        >
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1.5">
              <span className="font-semibold text-muted-foreground flex items-center gap-1 font-mono">
                <Calendar className="h-3.5 w-3.5 text-blue-500" />
                Meta Anual {anoDesempenho}
              </span>
              {consultorStats.desempenhoMetaAno != null && (
                <span className="text-[10px] font-mono font-bold text-blue-600 dark:text-blue-400">
                  {formatPct(consultorStats.desempenhoMetaAno)} do ano
                </span>
              )}
            </div>

            <p className="font-mono font-bold text-2xl text-foreground tabular-nums mb-2">
              {formatBRL(consultorStats.metaAno)}
            </p>

            {/* Barra de Progresso Anual */}
            {consultorStats.metaAno > 0 && (
              <div className="mb-3 h-2 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                <div
                  className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-blue-500 to-emerald-500"
                  style={{ width: `${percentMetaAno}%` }}
                />
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2.5 border-t text-[11px]" style={{ borderColor: "var(--voux-card-border)" }}>
            <div>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Vendido no Ano</p>
              <p className="font-mono font-bold text-[14px] text-foreground tabular-nums truncate">
                {formatBRL(consultorStats.vendaAno)}
              </p>
              <p className="text-[9px] font-mono text-muted-foreground">
                {consultorStats.quantidadeVendasAno} pedidos no ano
              </p>
            </div>

            <div className="border-l pl-2" style={{ borderColor: "var(--voux-card-border)" }}>
              <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Falta no Ano</p>
              <p className="font-mono font-semibold text-[13px] text-rose-500 tabular-nums truncate">
                {consultorStats.saldoMetaAno > 0 ? formatBRL(consultorStats.saldoMetaAno) : "Meta Batida!"}
              </p>
              <p className="text-[9px] font-mono text-muted-foreground">
                {consultorStats.negociosAno} neg no ano
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* SEÇÃO 2: PIPELINE ATIVO & INTELIGÊNCIA ARTIFICIAL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Negócios no Pipeline Ativo (Largo - 8 colunas) */}
        <div className="lg:col-span-8 h-full">
          <ConsultorNegociosPipelineCard consultor={v.nome} />
        </div>

        {/* Inteligência do Consultor · IA (4 colunas) */}
        <div className="lg:col-span-4 h-full">
          <InsightConsultorCard consultor={v.nome} />
        </div>
      </div>

      {/* SEÇÃO 3: GRÁFICOS DE EVOLUÇÃO NO ANO ATUAL (Janeiro a Dezembro de 2026) */}
      <div className="space-y-4">
        {/* Evolução Mensal — Janeiro a Dezembro de 2026 */}
        <ChartCard
          title={`Evolução Mensal · Ano ${anoDesempenho}`}
          description={`Ações e visitas mensais no ano de ${anoDesempenho} (Janeiro a Dezembro)`}
          label={`EVOLUÇÃO · ANO ${anoDesempenho}`}
          height={300}
        >
          <LineChart
            series={[
              {
                name: "Ações",
                data: evolucaoAno.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.acoes })),
                color: "#4caf7a",
              },
              {
                name: "Visitas",
                data: evolucaoAno.map((d) => ({ x: formatMonthYear(d.YearMonth), y: d.visitas })),
                color: "#d4a05a",
              },
            ]}
            height={300}
            independentAxes
          />
        </ChartCard>

        {/* Desempenho Comercial — GPO (Ano 2026) */}
        <ChartCard
          title={`Desempenho Comercial (GPO) · Ano ${anoDesempenho}`}
          description={`Vendas fechadas, perdas e novas oportunidades geradas no ano de ${anoDesempenho}`}
          label={`COMERCIAL · ANO ${anoDesempenho}`}
          height={280}
          loading={gpoLoading}
        >
          <EvolucaoGPOChart data={gpoDataAno} height={280} />
        </ChartCard>
      </div>

      {/* SEÇÃO 4: DISTRIBUIÇÃO DE CAMPO & CLIENTES ATENDIDOS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Distribuição de Ações de Campo (4 colunas) */}
        <div className="lg:col-span-4 h-full">
          <ConsultorDistribuicaoCampoCard
            tiposAcao={v.tiposAcao}
            totalAcoes={v.totalAcoes}
            visitas={consultorStats.visitas}
            clientes={consultorStats.clientes}
          />
        </div>

        {/* Tabela de Clientes Atendidos (8 colunas) */}
        <div className="lg:col-span-8">
          <div
            className="rounded-2xl border overflow-hidden"
            style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-raised)", boxShadow: "var(--voux-card-shadow)" }}
          >
            <div className="px-5 pt-4 pb-3 flex items-baseline justify-between border-b" style={{ borderColor: "var(--voux-card-border)" }}>
              <div>
                <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--voux-font-sans)" }}>
                  Clientes Atendidos pelo Consultor
                </h3>
                <p className="text-[11px] text-muted-foreground">
                  Auditoria de carteira, interações registradas e histórico de negócios
                </p>
              </div>
              <span className="text-[11px] font-mono text-muted-foreground">
                {v.topClientes.length} clientes na carteira
              </span>
            </div>

            <div className="p-4 max-h-[460px] overflow-y-auto">
              <div
                className="grid grid-cols-[32px_1fr_100px_60px_60px_110px_90px_80px_32px] items-center px-2 py-2 border-b text-[11px] tracking-[0.12em] uppercase font-semibold text-muted-foreground font-mono"
                style={{ borderColor: "var(--voux-card-border)" }}
              >
                <span>#</span>
                <span>Cliente</span>
                <span>Cidade</span>
                <span className="text-center">Ações</span>
                <span className="text-center">Visitas</span>
                <span className="text-right">Valor Vinculado</span>
                <span className="text-center">Dias s/ Contato</span>
                <span className="text-center">Status</span>
                <span></span>
              </div>

              {v.topClientes.map((c, i) => (
                <ConsultorClienteCard
                  key={c.nome}
                  cliente={c}
                  rank={i + 1}
                  actions={clientActions.get(c.nome) || []}
                  vendedorNome={v.nome}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
