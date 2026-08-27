import { useState, useMemo, memo } from "react";
import {
  Trophy,
  Award,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Target,
  Calendar,
  Briefcase,
  Users,
  Compass,
  CheckCircle2,
  AlertCircle,
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

type SortOption =
  | "vendas_mes"
  | "vendas_mes_menor"
  | "vendas_ano"
  | "meta_mes"
  | "meta_mes_menor"
  | "meta_ano"
  | "pipeline"
  | "visitas"
  | "conversao"
  | "nome";

type FilterStatus =
  | "todos"
  | "meta_mes_batida"
  | "em_rota"
  | "meta_ano_alta"
  | "abaixo"
  | "critico"
  | "sem_vendas"
  | "com_vendas";

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
  return `${value.toFixed(1)} ${unit}`;
}

const MESES_LONGOS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
];

function getNomeMes(ym: string): string {
  if (!ym) return "";
  const parts = ym.split("-");
  const m = parseInt(parts[1] ?? "1", 10);
  return MESES_LONGOS[m - 1] ?? ym;
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
  const [ordenacao, setOrdenacao] = useState<SortOption>("vendas_mes");
  const [filtroStatus, setFiltroStatus] = useState<FilterStatus>("todos");
  const [expandido, setExpandido] = useState(false);

  const resumoPorConsultor = useMemo(
    () => new Map(resumo.map((item) => [item.consultor, item])),
    [resumo]
  );

  // Determinar competência atual, mês anterior e se é período multi-mês (ex.: ano inteiro)
  const { compAtual, compAnterior, isMultiMonth, fromYm, toYm, prevYm } = useMemo(() => {
    let fYm = "";
    let tYm = "";
    if (filters.dateRange?.from) {
      fYm = filters.dateRange.from.slice(0, 7);
      tYm = (filters.dateRange.to || filters.dateRange.from).slice(0, 7);
    } else {
      const currentYear = new Date().getFullYear();
      fYm = `${currentYear}-01`;
      tYm = `${currentYear}-12`;
    }
    const isMulti = fYm !== tYm;
    const current = `${tYm}-01`;

    const [yearStr, monthStr] = tYm.split("-");
    const y = parseInt(yearStr, 10);
    const m = parseInt(monthStr, 10);
    const prevDate = new Date(y, m - 2, 1);
    const pYm = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const previous = `${pYm}-01`;

    return {
      compAtual: current,
      compAnterior: previous,
      isMultiMonth: isMulti,
      fromYm: fYm,
      toYm: tYm,
      prevYm: pYm,
    };
  }, [filters.dateRange]);

  // Consolidar dados completos e acumulados de cada consultor
  const consultoresProcessados = useMemo(() => {
    const rowsPorConsultor = new Map<string, typeof desempenho.rows>();
    for (const r of desempenho.rows) {
      if (!r.consultor || r.consultor === "Sem consultor") continue;
      if (!rowsPorConsultor.has(r.consultor)) {
        rowsPorConsultor.set(r.consultor, []);
      }
      rowsPorConsultor.get(r.consultor)!.push(r);
    }

    const consultorMap = new Map<string, Vendedor | undefined>();
    for (const v of vendedores) {
      if (v.nome && v.nome !== "Sem consultor") consultorMap.set(v.nome, v);
    }
    for (const [name] of rowsPorConsultor.entries()) {
      if (!consultorMap.has(name)) {
        consultorMap.set(name, undefined);
      }
    }

    const result = [];

    for (const [nome, v] of consultorMap.entries()) {
      const cRows = rowsPorConsultor.get(nome) ?? [];
      const rAtual = cRows.find((r) => r.competencia.startsWith(toYm) || r.competencia === compAtual);
      const rAnterior = cRows.find((r) => r.competencia.startsWith(prevYm) || r.competencia === compAnterior);
      const res = resumoPorConsultor.get(nome);

      // --- MÊS ATUAL ---
      const vendaMes = Number(rAtual?.total_venda ?? res?.valor_ganho ?? 0);
      const vendaAnterior = Number(rAnterior?.total_venda ?? 0);
      const deltaVenda =
        vendaAnterior > 0 ? ((vendaMes - vendaAnterior) / vendaAnterior) * 100 : null;

      const metaMes = Number(rAtual?.meta ?? 0);
      const desempenhoMetaMes =
        metaMes > 0 ? (vendaMes / metaMes) * 100 : rAtual?.desempenho_meta != null ? Number(rAtual.desempenho_meta) : null;
      const saldoMetaMes = metaMes - vendaMes;

      // --- VENDAS DO PERÍODO SELECIONADO (MULTIMÊS OU ANO INTEIRO) ---
      const rowsDoPeriodo = cRows.filter((r) => {
        const rYm = r.competencia.slice(0, 7);
        return rYm >= fromYm && rYm <= toYm;
      });
      const vendaPeriodo = isMultiMonth
        ? rowsDoPeriodo.reduce((sum, r) => sum + Number(r.total_venda ?? 0), 0)
        : vendaMes;
      const metaPeriodo = isMultiMonth
        ? rowsDoPeriodo.reduce((sum, r) => sum + Number(r.meta ?? 0), 0)
        : metaMes;
      const desempenhoMetaPeriodo =
        metaPeriodo > 0 ? (vendaPeriodo / metaPeriodo) * 100 : desempenhoMetaMes;

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
          : Number(res?.carteira_ativa_trabalhada ?? v?.pipeline ?? 0);

      // --- QUANTIDADES E MÉDIAS DO MÊS ---
      const quantidadeVendasMes = Number(rAtual?.quantidade_vendas ?? res?.ganhos ?? 0);
      const oportunidadesAbertas = Number(rAtual?.oportunidades_abertas ?? 0);
      const negociosMes = Number(rAtual?.negocios ?? res?.oportunidades_geradas ?? v?.negocios ?? 0);

      const ticketMedioMes =
        rAtual?.ticket_medio != null
          ? Number(rAtual.ticket_medio)
          : quantidadeVendasMes > 0 && vendaMes > 0
          ? vendaMes / quantidadeVendasMes
          : null;

      const taxaConversaoMes =
        rAtual?.taxa_conversao_negocios != null
          ? Number(rAtual.taxa_conversao_negocios)
          : res?.taxa_ganho != null
          ? Number(res.taxa_ganho)
          : v?.conversao ?? null;

      // --- QUANTIDADES E MÉDIAS DO PERÍODO SELECIONADO (MULTIMÊS OU ANO INTEIRO) ---
      const quantidadeVendasPeriodo = isMultiMonth
        ? Math.max(
            rowsDoPeriodo.reduce((sum, r) => sum + Number(r.quantidade_vendas ?? 0), 0),
            Number(res?.ganhos ?? 0)
          )
        : quantidadeVendasMes;

      const negociosPeriodo = isMultiMonth
        ? Math.max(
            rowsDoPeriodo.reduce((sum, r) => sum + Number(r.negocios ?? 0), 0),
            Number(res?.oportunidades_geradas ?? res?.negocios_abertos_tocados ?? v?.negocios ?? 0)
          )
        : negociosMes;

      const ticketMedioPeriodo =
        quantidadeVendasPeriodo > 0 && vendaPeriodo > 0
          ? vendaPeriodo / quantidadeVendasPeriodo
          : isMultiMonth
          ? ticketMedioAno
          : ticketMedioMes;

      const taxaConversaoPeriodo =
        negociosPeriodo > 0 && quantidadeVendasPeriodo > 0
          ? (quantidadeVendasPeriodo / negociosPeriodo) * 100
          : isMultiMonth
          ? (negociosAno > 0 && quantidadeVendasAno > 0 ? (quantidadeVendasAno / negociosAno) * 100 : (res?.taxa_ganho != null ? Number(res.taxa_ganho) : null))
          : taxaConversaoMes;

      // --- AÇÕES E ESFORÇO DE CAMPO ---
      const visitas = Number(res?.visitas ?? v?.visitas ?? 0);
      const clientes = Number(res?.clientes ?? rAtual?.clientes ?? v?.clientes ?? 0);
      const prospeccaoMaquina = Number(rAtual?.prospeccao_maquina ?? 0);

      const visitasPorOportunidade =
        negociosMes > 0 && visitas > 0 ? visitas / negociosMes : null;
      const clientesPorVenda =
        quantidadeVendasMes > 0 && clientes > 0 ? clientes / quantidadeVendasMes : null;
      const visitasPorVenda =
        quantidadeVendasMes > 0 && visitas > 0 ? visitas / quantidadeVendasMes : null;

      // Médias para o período selecionado
      const visitasPeriodo = visitas;
      const clientesPeriodo = clientes;
      const visitasPorOportunidadePeriodo =
        negociosPeriodo > 0 && visitasPeriodo > 0 ? visitasPeriodo / negociosPeriodo : null;
      const clientesPorVendaPeriodo =
        quantidadeVendasPeriodo > 0 && clientesPeriodo > 0 ? clientesPeriodo / quantidadeVendasPeriodo : null;
      const visitasPorVendaPeriodo =
        quantidadeVendasPeriodo > 0 && visitasPeriodo > 0 ? visitasPeriodo / quantidadeVendasPeriodo : null;

      const crmQuality = res?.crm_quality ?? v?.crmQuality ?? 0;
      const totalAcoes = v?.totalAcoes ?? Number(res?.acoes ?? 0);

      const hasAnyActivity =
        oportunidade > 0 ||
        cotacao > 0 ||
        proposta > 0 ||
        totalPipeline > 0 ||
        vendaPeriodo > 0 ||
        vendaMes > 0 ||
        vendaAno > 0 ||
        quantidadeVendasPeriodo > 0 ||
        quantidadeVendasAno > 0 ||
        visitas > 0 ||
        clientes > 0;

      if (!hasAnyActivity) continue;

      result.push({
        nome,
        // Período Selecionado
        vendaPeriodo,
        metaPeriodo,
        desempenhoMetaPeriodo,
        quantidadeVendasPeriodo,
        negociosPeriodo,
        ticketMedioPeriodo,
        taxaConversaoPeriodo,
        visitasPeriodo,
        clientesPeriodo,
        visitasPorOportunidadePeriodo,
        clientesPorVendaPeriodo,
        visitasPorVendaPeriodo,
        // Mês
        vendaMes,
        vendaAnterior,
        deltaVenda,
        metaMes,
        desempenhoMetaMes,
        saldoMetaMes,
        quantidadeVendasMes,
        ticketMedioMes,
        taxaConversaoMes,
        // Ano
        metaAno,
        vendaAno,
        saldoMetaAno,
        desempenhoMetaAno,
        quantidadeVendasAno,
        negociosAno,
        ticketMedioAno,
        // Pipeline
        oportunidade,
        cotacao,
        proposta,
        totalPipeline,
        oportunidadesAbertas,
        negociosMes,
        // Campo
        visitas,
        clientes,
        prospeccaoMaquina,
        visitasPorOportunidade,
        clientesPorVenda,
        visitasPorVenda,
        crmQuality,
        totalAcoes,
      });
    }

    return result;
  }, [vendedores, desempenho.rows, resumoPorConsultor, compAtual, compAnterior, isMultiMonth, fromYm, toYm, prevYm]);

  // Ordenação
  const consultoresOrdenados = useMemo(() => {
    return [...consultoresProcessados].sort((a, b) => {
      switch (ordenacao) {
        case "vendas_mes":
          return (
            (b.vendaPeriodo - a.vendaPeriodo) ||
            (b.vendaAno - a.vendaAno) ||
            (b.quantidadeVendasPeriodo - a.quantidadeVendasPeriodo) ||
            (b.quantidadeVendasAno - a.quantidadeVendasAno) ||
            ((b.desempenhoMetaPeriodo ?? 0) - (a.desempenhoMetaPeriodo ?? 0)) ||
            (b.totalPipeline - a.totalPipeline) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "vendas_mes_menor":
          return (
            (a.vendaPeriodo - b.vendaPeriodo) ||
            (a.vendaAno - b.vendaAno) ||
            (a.quantidadeVendasPeriodo - b.quantidadeVendasPeriodo) ||
            (a.quantidadeVendasAno - b.quantidadeVendasAno) ||
            ((a.desempenhoMetaPeriodo ?? 0) - (b.desempenhoMetaPeriodo ?? 0)) ||
            (a.totalPipeline - b.totalPipeline) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "vendas_ano":
          return (
            (b.vendaAno - a.vendaAno) ||
            (b.vendaPeriodo - a.vendaPeriodo) ||
            (b.quantidadeVendasAno - a.quantidadeVendasAno) ||
            (b.quantidadeVendasPeriodo - a.quantidadeVendasPeriodo) ||
            ((b.desempenhoMetaAno ?? 0) - (a.desempenhoMetaAno ?? 0)) ||
            (b.totalPipeline - a.totalPipeline) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "meta_mes":
          return (
            ((b.desempenhoMetaPeriodo ?? -1) - (a.desempenhoMetaPeriodo ?? -1)) ||
            (b.vendaPeriodo - a.vendaPeriodo) ||
            (b.totalPipeline - a.totalPipeline) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "meta_mes_menor":
          return (
            ((a.desempenhoMetaPeriodo ?? 999) - (b.desempenhoMetaPeriodo ?? 999)) ||
            (a.vendaPeriodo - b.vendaPeriodo) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "meta_ano":
          return (
            ((b.desempenhoMetaAno ?? -1) - (a.desempenhoMetaAno ?? -1)) ||
            (b.vendaAno - a.vendaAno) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "pipeline":
          return (
            (b.totalPipeline - a.totalPipeline) ||
            (b.vendaPeriodo - a.vendaPeriodo) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "visitas":
          return (
            (b.visitas - a.visitas) ||
            (b.vendaPeriodo - a.vendaPeriodo) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "conversao":
          return (
            ((b.taxaConversaoMes ?? -1) - (a.taxaConversaoMes ?? -1)) ||
            (b.vendaPeriodo - a.vendaPeriodo) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
        case "nome":
          return a.nome.localeCompare(b.nome, "pt-BR");
        default:
          return (
            (b.vendaPeriodo - a.vendaPeriodo) ||
            ((b.desempenhoMetaPeriodo ?? 0) - (a.desempenhoMetaPeriodo ?? 0)) ||
            a.nome.localeCompare(b.nome, "pt-BR")
          );
      }
    });
  }, [consultoresProcessados, ordenacao]);

  // Filtros de busca e status
  const consultoresFiltrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const list = consultoresOrdenados.filter((c) => {
      if (q && !c.nome.toLowerCase().includes(q)) return false;

      switch (filtroStatus) {
        case "meta_mes_batida":
          return c.desempenhoMetaPeriodo != null && c.desempenhoMetaPeriodo >= 100;
        case "meta_ano_alta":
          return c.desempenhoMetaAno != null && c.desempenhoMetaAno >= 50;
        case "em_rota":
          return c.desempenhoMetaPeriodo != null && c.desempenhoMetaPeriodo >= 70 && c.desempenhoMetaPeriodo < 100;
        case "abaixo":
          return c.desempenhoMetaPeriodo != null && c.desempenhoMetaPeriodo < 70 && c.metaPeriodo > 0;
        case "critico":
          return (
            (c.desempenhoMetaPeriodo != null && c.desempenhoMetaPeriodo < 30 && c.metaPeriodo > 0) ||
            (c.vendaPeriodo === 0 && c.metaPeriodo > 0)
          );
        case "sem_vendas":
          return c.vendaPeriodo === 0;
        case "com_vendas":
          return c.vendaPeriodo > 0;
        default:
          return true;
      }
    });

    // Se estiver filtrando especificamente por críticos/muito abaixo e a ordenação for a padrão,
    // ordena automaticamente do pior para o melhor (crescente) para evidenciar os mais distantes da meta
    if (filtroStatus === "critico" && ordenacao === "vendas_mes") {
      return [...list].sort(
        (a, b) =>
          (a.desempenhoMetaPeriodo ?? 0) - (b.desempenhoMetaPeriodo ?? 0) ||
          a.vendaPeriodo - b.vendaPeriodo ||
          a.nome.localeCompare(b.nome, "pt-BR")
      );
    }

    return list;
  }, [consultoresOrdenados, busca, filtroStatus, ordenacao]);

  const cardsVisiveis = expandido ? consultoresFiltrados : consultoresFiltrados.slice(0, 9);

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
                {consultoresFiltrados.length} {consultoresFiltrados.length === 1 ? "consultor" : "consultores"} com pipeline ativo
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dossiê 360° dos consultores ranqueados por vendas e acompanhamento de metas
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
            <option value="vendas_mes">
              {isMultiMonth ? "Maior Venda no Período Selecionado" : "Maior Venda no Mês"}
            </option>
            <option value="vendas_mes_menor">
              {isMultiMonth ? "🚨 Menor Venda no Período" : "🚨 Menor Venda no Mês (Piores Resultados)"}
            </option>
            <option value="meta_mes">
              {isMultiMonth ? "Maior % da Meta no Período" : "Maior % da Meta do Mês"}
            </option>
            <option value="meta_mes_menor">
              {isMultiMonth ? "⚠️ Menor % da Meta no Período" : "⚠️ Menor % da Meta (Mais Distante)"}
            </option>
            <option value="vendas_ano">Maior Venda no Ano (YTD)</option>
            <option value="meta_ano">Maior % da Meta do Ano</option>
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
          { id: "meta_mes_batida", label: "🏆 Meta Batida (≥100%)" },
          { id: "em_rota", label: "⚡ Em Rota (70%–99%)" },
          { id: "meta_ano_alta", label: "📅 Alta no Ano (≥50%)" },
          { id: "abaixo", label: "⚠️ Abaixo no Mês (<70%)" },
          { id: "critico", label: "🚨 Muito Abaixo / Crítico (<30%)" },
          { id: "sem_vendas", label: "📉 Sem Vendas no Mês" },
          { id: "com_vendas", label: "💰 Com Vendas no Mês" },
        ].map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroStatus(f.id as FilterStatus)}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium transition-all",
              filtroStatus === f.id
                ? f.id === "critico"
                  ? "bg-rose-500 text-white font-bold shadow-sm"
                  : "bg-amber-500 text-amber-950 font-bold shadow-sm"
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
            const metaMesValor = isMultiMonth ? c.metaPeriodo : c.metaMes;
            const vendaMesValor = isMultiMonth ? c.vendaPeriodo : c.vendaMes;
            const saldoMetaValor = isMultiMonth ? c.metaPeriodo - c.vendaPeriodo : c.saldoMetaMes;
            const desempenhoMetaValor = isMultiMonth ? c.desempenhoMetaPeriodo : c.desempenhoMetaMes;

            const quantidadeVendasValor = isMultiMonth ? c.quantidadeVendasPeriodo : c.quantidadeVendasMes;
            const ticketMedioValor = isMultiMonth ? c.ticketMedioPeriodo : (c.ticketMedioMes ?? c.ticketMedioAno);
            const taxaConversaoValor = isMultiMonth ? c.taxaConversaoPeriodo : c.taxaConversaoMes;
            const negociosValor = isMultiMonth ? c.negociosPeriodo : c.negociosMes;
            const visitasValor = isMultiMonth ? c.visitasPeriodo : c.visitas;
            const clientesValor = isMultiMonth ? c.clientesPeriodo : c.clientes;
            const visitasPorOportunidadeValor = isMultiMonth ? c.visitasPorOportunidadePeriodo : c.visitasPorOportunidade;
            const clientesPorVendaValor = isMultiMonth ? c.clientesPorVendaPeriodo : c.clientesPorVenda;

            const percentMetaMes = desempenhoMetaValor != null ? Math.min(Math.max(desempenhoMetaValor, 0), 100) : 0;
            const percentMetaAno = c.desempenhoMetaAno != null ? Math.min(Math.max(c.desempenhoMetaAno, 0), 100) : 0;
            const isTop3 = index < 3 && (ordenacao === "vendas_mes" || ordenacao === "vendas_ano");
            const metaMesSuperada = desempenhoMetaValor != null && desempenhoMetaValor >= 100;
            const emRotaMes = desempenhoMetaValor != null && desempenhoMetaValor >= 70 && desempenhoMetaValor < 100;

            const anoStr = toYm.slice(0, 4);
            const isYtd = fromYm.endsWith("-01") && toYm.slice(0, 4) === fromYm.slice(0, 4);
            const [y1, m1] = fromYm.split("-").map(Number);
            const [y2, m2] = toYm.split("-").map(Number);
            const numMesesPeriodo = Math.max((y2 - y1) * 12 + (m2 - m1) + 1, 1);
            const labelFimPeriodo = getNomeMes(toYm);
            const labelInicioPeriodo = getNomeMes(fromYm);
            const labelPeriodo = isYtd
              ? `até ${labelFimPeriodo}`
              : `${labelInicioPeriodo} a ${labelFimPeriodo}`;
            const mediaMensalRealizada = c.vendaPeriodo / numMesesPeriodo;

            const crmBadge =
              c.crmQuality >= 70
                ? { label: "Nota A", bg: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" }
                : c.crmQuality >= 50
                ? { label: "Nota B", bg: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" }
                : { label: "Nota C", bg: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20" };

            return (
              <div
                key={c.nome}
                onDoubleClick={() => onSelectConsultor(c.nome)}
                className={cn(
                  "group relative flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300 cursor-pointer select-none",
                  "hover:shadow-xl hover:scale-[1.01] hover:border-amber-500/40",
                  ribbon?.glow ?? "border-[var(--voux-card-border)]"
                )}
                style={{
                  background: "var(--surface-raised)",
                  borderColor: isTop3 ? ribbon?.glow : "var(--voux-card-border)",
                  boxShadow: "var(--voux-card-shadow)",
                }}
                title="Dê um duplo clique para abrir o dossiê completo deste consultor"
              >
                <div>
                  {/* Top Header: Avatar, Nome, Posição & Badges */}
                  <div className="flex items-start justify-between gap-2.5 mb-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div
                        className="relative cursor-pointer"
                        onClick={() => onSelectConsultor(c.nome)}
                        title="Ver dossiê do consultor"
                      >
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
                        <h4
                          className="truncate text-[13px] font-bold text-foreground group-hover:text-amber-500 transition-colors cursor-pointer"
                          onClick={() => onSelectConsultor(c.nome)}
                          title={c.nome}
                        >
                          {c.nome}
                        </h4>
                        <p className="text-[10px] font-mono text-muted-foreground truncate">
                          {c.totalAcoes} ações registradas · CRM {crmBadge.label}
                        </p>
                      </div>
                    </div>

                    {/* Meta Badge */}
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      {isMultiMonth ? (
                        c.desempenhoMetaAno != null && c.metaAno > 0 ? (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border tabular-nums",
                              c.desempenhoMetaAno >= 100
                                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                                : c.desempenhoMetaAno >= 70
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                            )}
                            title={`Meta Anual: ${formatPct(c.desempenhoMetaAno)} · Ritmo até ${labelFimPeriodo}: ${formatPct(c.desempenhoMetaPeriodo)}`}
                          >
                            {c.desempenhoMetaAno >= 100 ? (
                              <CheckCircle2 className="h-3 w-3" />
                            ) : c.desempenhoMetaAno >= 70 ? (
                              <Sparkles className="h-3 w-3" />
                            ) : (
                              <AlertCircle className="h-3 w-3 text-rose-500" />
                            )}
                            {formatPct(c.desempenhoMetaAno)} ano
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-muted-foreground border border-black/5 dark:border-white/10">
                            Sem meta anual
                          </span>
                        )
                      ) : desempenhoMetaValor != null && metaMesValor > 0 ? (
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold border tabular-nums",
                            metaMesSuperada
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                              : emRotaMes
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
                              : desempenhoMetaValor < 30 || vendaMesValor === 0
                              ? "bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30"
                              : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
                          )}
                        >
                          {metaMesSuperada ? (
                            <CheckCircle2 className="h-3 w-3" />
                          ) : emRotaMes ? (
                            <Sparkles className="h-3 w-3" />
                          ) : (
                            <AlertCircle
                              className={cn(
                                "h-3 w-3",
                                (desempenhoMetaValor < 30 || vendaMesValor === 0) && "text-rose-500 animate-pulse"
                              )}
                            />
                          )}
                          {formatPct(desempenhoMetaValor)} mês
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-mono text-muted-foreground border border-black/5 dark:border-white/10">
                          Sem meta mês
                        </span>
                      )}
                    </div>
                  </div>

                  {/* SELEÇÃO CONDICIONAL DE BLOCOS DE METAS: MULTIMÊS / ANO vs MÊS ÚNICO */}
                  {isMultiMonth ? (
                    /* BLOCO UNIFICADO: META ANUAL (12 MESES) & RITMO ACUMULADO NO PERÍODO */
                    <div className="mb-2.5 rounded-xl border p-3 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      {/* 1. Meta Anual 12 Meses */}
                      <div className="flex items-center justify-between text-[11px] mb-1.5">
                        <span className="font-semibold text-muted-foreground flex items-center gap-1">
                          <Award className="h-3.5 w-3.5 text-amber-500" />
                          Meta Anual {anoStr} (12 Meses): <strong className="font-mono text-foreground">{formatBRL(c.metaAno)}</strong>
                        </span>
                        {c.desempenhoMetaAno != null ? (
                          <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                            {formatPct(c.desempenhoMetaAno)} batido
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-muted-foreground">Sem meta</span>
                        )}
                      </div>

                      {/* Barra de Progresso da Meta Anual */}
                      {c.metaAno > 0 && (
                        <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                          <div
                            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500"
                            style={{ width: `${percentMetaAno}%` }}
                          />
                        </div>
                      )}

                      {/* Grid Anual: Faturado no Ano vs Falta p/ Meta Anual */}
                      <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                        <div>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Faturado no Ano</p>
                          <p className="font-mono font-bold text-[13px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                            {formatBRL(c.vendaAno)}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {c.quantidadeVendasAno} {c.quantidadeVendasAno === 1 ? "pedido" : "pedidos"} no ano
                          </p>
                        </div>

                        <div className="border-l pl-2" style={{ borderColor: "var(--voux-card-border)" }}>
                          <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Falta p/ Meta Anual</p>
                          <p className="font-mono font-semibold text-[13px] text-rose-500 tabular-nums">
                            {c.saldoMetaAno > 0 ? formatBRL(c.saldoMetaAno) : "Meta Anual Batida!"}
                          </p>
                          <p className="text-[10px] font-mono text-muted-foreground">
                            {c.negociosAno} neg no ano
                          </p>
                        </div>
                      </div>

                      {/* 2. Sub-painel Didático: Ritmo Acumulado Esperado até o Momento (YTD) */}
                      {c.metaPeriodo > 0 && (
                        <div className="mt-2.5 pt-2 border-t rounded-lg bg-black/[0.02] dark:bg-white/[0.02] p-2" style={{ borderColor: "var(--voux-card-border)" }}>
                          <div className="flex items-center justify-between text-[10px] mb-1">
                            <span className="font-semibold text-muted-foreground font-mono flex items-center gap-1">
                              <Target className="h-3 w-3 text-sky-500" />
                              {isYtd
                                ? `Ritmo Esperado até ${labelFimPeriodo} (${numMesesPeriodo} meses)`
                                : `Meta do Período (${labelPeriodo})`}
                            </span>
                            <span className="font-mono font-bold text-sky-600 dark:text-sky-400">
                              {formatBRL(c.metaPeriodo)} ({formatPct(c.desempenhoMetaPeriodo)})
                            </span>
                          </div>

                          {/* Mini barra de ritmo */}
                          <div className="mb-1.5 h-1 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div
                              className={cn(
                                "h-full rounded-full transition-all duration-500",
                                c.desempenhoMetaPeriodo != null && c.desempenhoMetaPeriodo >= 100
                                  ? "bg-emerald-500"
                                  : c.desempenhoMetaPeriodo != null && c.desempenhoMetaPeriodo >= 70
                                  ? "bg-amber-500"
                                  : "bg-rose-500"
                              )}
                              style={{ width: `${Math.min(Math.max(c.desempenhoMetaPeriodo ?? 0, 0), 100)}%` }}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                            <span>
                              {saldoMetaValor > 0 ? (
                                <>Déficit no ritmo: <strong className="text-rose-500">{formatBRL(saldoMetaValor)}</strong></>
                              ) : (
                                <strong className="text-emerald-500 font-bold">Ritmo do período superado!</strong>
                              )}
                            </span>
                            <span>
                              Média: <strong className="text-foreground">{formatBRL(mediaMensalRealizada)}/mês</strong>
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* VISUALIZAÇÃO DE MÊS ÚNICO (BLOCO 1: MÊS ATUAL + BLOCO 2: ANO) */
                    <>
                      {/* BLOCO 1: META DO MÊS & VENDAS DO MÊS */}
                      <div className="mb-2.5 rounded-xl border p-3 bg-black/[0.02] dark:bg-white/[0.02]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1">
                            <Target className="h-3.5 w-3.5 text-amber-500" />
                            Meta de {getNomeMes(compAtual)}: <strong className="font-mono text-foreground">{formatBRL(c.metaMes)}</strong>
                          </span>
                          {c.saldoMetaMes > 0 && c.metaMes > 0 ? (
                            <span className="text-[10px] font-mono text-muted-foreground">
                              Falta: <strong className="text-rose-500">{formatBRL(c.saldoMetaMes)}</strong>
                            </span>
                          ) : c.metaMes > 0 ? (
                            <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                              Meta Batida!
                            </span>
                          ) : null}
                        </div>

                        {/* Barra de Progresso do Mês */}
                        {c.metaMes > 0 && (
                          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
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

                        {/* Grid Mês: Vendido Atual vs Mês Passado */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Vendido no Mês</p>
                            <p className="font-mono font-bold text-[13px] text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {formatBRL(c.vendaMes)}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {c.quantidadeVendasMes} {c.quantidadeVendasMes === 1 ? "venda" : "vendas"}
                            </p>
                          </div>

                          <div className="border-l pl-2" style={{ borderColor: "var(--voux-card-border)" }}>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Mês Passado</p>
                            <div className="flex items-center gap-1">
                              <p className="font-mono font-semibold text-[12px] text-foreground tabular-nums">
                                {formatBRL(c.vendaAnterior)}
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
                          </div>
                        </div>
                      </div>

                      {/* BLOCO 2: ACUMULADO DO ANO (12 MESES) */}
                      <div className="mb-2.5 rounded-xl border p-3 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <div className="flex items-center justify-between text-[11px] mb-1.5">
                          <span className="font-semibold text-muted-foreground flex items-center gap-1">
                            <Award className="h-3.5 w-3.5 text-amber-500" />
                            Meta Anual {anoStr} (12 Meses): <strong className="font-mono text-foreground">{formatBRL(c.metaAno)}</strong>
                          </span>
                          {c.desempenhoMetaAno != null ? (
                            <span className="text-[10px] font-mono font-bold text-amber-600 dark:text-amber-400">
                              {formatPct(c.desempenhoMetaAno)}
                            </span>
                          ) : (
                            <span className="text-[10px] font-mono text-muted-foreground">Sem meta</span>
                          )}
                        </div>

                        {/* Barra de Progresso Anual */}
                        {c.metaAno > 0 && (
                          <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                            <div
                              className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-amber-500 via-amber-400 to-emerald-500"
                              style={{ width: `${percentMetaAno}%` }}
                            />
                          </div>
                        )}

                        {/* Grid Ano: Vendido no Ano vs Falta p/ Meta Anual */}
                        <div className="grid grid-cols-2 gap-2 pt-1 border-t" style={{ borderColor: "var(--voux-card-border)" }}>
                          <div>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Vendido no Ano</p>
                            <p className="font-mono font-bold text-[13px] text-foreground tabular-nums">
                              {formatBRL(c.vendaAno)}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {c.quantidadeVendasAno} pedidos no ano
                            </p>
                          </div>

                          <div className="border-l pl-2" style={{ borderColor: "var(--voux-card-border)" }}>
                            <p className="text-[10px] uppercase font-semibold text-muted-foreground font-mono">Falta p/ Meta do Ano</p>
                            <p className="font-mono font-semibold text-[12px] text-rose-500 tabular-nums">
                              {c.saldoMetaAno > 0 ? formatBRL(c.saldoMetaAno) : "Meta Anual Batida!"}
                            </p>
                            <p className="text-[10px] font-mono text-muted-foreground">
                              {c.negociosAno} neg no ano
                            </p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}

                  {/* BLOCO 3: PIPELINE ATIVO (3 ETAPAS COM VALORES EXATOS) */}
                  <div className="mb-2.5">
                    <div className="flex items-center justify-between text-[11px] mb-1.5 px-0.5">
                      <span className="font-semibold text-muted-foreground flex items-center gap-1">
                        <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                        Pipeline Ativo ({c.oportunidadesAbertas} em aberto)
                      </span>
                      <span className="font-mono font-bold text-foreground text-[11px]">
                        Total: {formatBRL(c.totalPipeline)}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5">
                      {/* Oportunidade */}
                      <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground truncate font-mono">1. Oport.</p>
                        <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                          {formatBRL(c.oportunidade)}
                        </p>
                      </div>

                      {/* Cotação */}
                      <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground truncate font-mono">2. Cotação</p>
                        <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                          {formatBRL(c.cotacao)}
                        </p>
                      </div>

                      {/* Proposta */}
                      <div className="rounded-lg border p-1.5 text-center bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                        <p className="text-[9px] font-semibold uppercase text-muted-foreground truncate font-mono">3. Proposta</p>
                        <p className="text-[11px] font-bold font-mono text-foreground tabular-nums truncate">
                          {formatBRL(c.proposta)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* BLOCO 4: EFICIÊNCIA & MÉDIAS DE ESFORÇO DE CAMPO (GRID 2x2) */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    {/* Ticket Médio */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono">Ticket Médio</p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px] truncate">
                        {formatBRL(ticketMedioValor)}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                        {isMultiMonth ? "no período selecionado" : (c.ticketMedioMes != null ? "no mês atual" : "média no ano")}
                      </p>
                    </div>

                    {/* Taxa de Conversão */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono">Tx. Conversão</p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {formatPct(taxaConversaoValor)}
                      </p>
                      <p className="text-[9px] text-muted-foreground font-mono truncate">
                        {quantidadeVendasValor} vda / {negociosValor} neg
                      </p>
                    </div>

                    {/* Visitas & Visitas p/ Oportunidade */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Compass className="h-3 w-3 text-amber-500" />
                        {isMultiMonth ? "Visitas no Período" : "Visitas no Mês"}
                      </p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {visitasValor} <span className="text-[10px] font-normal text-muted-foreground">visitas</span>
                      </p>
                      <p className="text-[9px] text-amber-600 dark:text-amber-400 font-mono font-medium truncate">
                        {formatRatio(visitasPorOportunidadeValor, "vis/oport.")}
                      </p>
                    </div>

                    {/* Clientes Únicos & Clientes p/ Venda */}
                    <div className="rounded-lg border p-2 bg-black/[0.01] dark:bg-white/[0.01]" style={{ borderColor: "var(--voux-card-border)" }}>
                      <p className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                        <Users className="h-3 w-3 text-emerald-500" />
                        {isMultiMonth ? "Clientes no Período" : "Clientes Únicos"}
                      </p>
                      <p className="font-mono font-bold text-foreground tabular-nums text-[12px]">
                        {clientesValor} <span className="text-[10px] font-normal text-muted-foreground">clientes</span>
                      </p>
                      <p className="text-[9px] text-emerald-600 dark:text-emerald-400 font-mono font-medium truncate">
                        {formatRatio(clientesPorVendaValor, "cli/venda")}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer do Card / Ação */}
                <div className="mt-3 pt-2.5 border-t flex items-center justify-between" style={{ borderColor: "var(--voux-card-border)" }}>
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
      {consultoresFiltrados.length > 9 && (
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
                Mostrar apenas os 9 primeiros
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
