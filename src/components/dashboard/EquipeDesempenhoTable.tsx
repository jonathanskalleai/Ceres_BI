import { Fragment, useMemo, useState, memo } from "react";
import { ChevronDown, ChevronRight, Settings2, Target, BarChart3, Users, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { formatMonthYear } from "@/lib/dateUtils";
import type { Filters } from "@/types/comercial";
import type { EquipeDesempenhoData, EquipeDesempenhoLinha } from "@/types/equipeDesempenho";
import { MetasEquipeDialog } from "./MetasEquipeDialog";
import { cn } from "@/lib/utils";

interface EquipeDesempenhoTableProps {
  ano: number;
  data: EquipeDesempenhoData;
  isAdmin: boolean;
  filters?: Filters;
  onSelectConsultor?: (nome: string) => void;
}

// Pre-instantiated number formatters for ultra-fast rendering without garbage collection pressure
const BRL_FORMATTER = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const NUMBER_FORMATTER = new Intl.NumberFormat("pt-BR");

const PCT_FORMATTER = new Intl.NumberFormat("pt-BR", {
  maximumFractionDigits: 1,
});

function asNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${PCT_FORMATTER.format(Number(value))}%`;
}

function money(value: number | null | undefined): string {
  return value == null ? "—" : BRL_FORMATTER.format(Number(value));
}

function rateBadge(value: number | null | undefined) {
  if (value == null) return <span className="text-muted-foreground">—</span>;
  const num = Number(value);
  const isHigh = num >= 100;
  const isMid = num >= 70;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold tabular-nums border",
        isHigh
          ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
          : isMid
          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"
          : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
      )}
    >
      {pct(value)}
    </span>
  );
}

function growthBadge(crescimento: number | null | undefined) {
  if (crescimento == null) return <span className="text-muted-foreground">—</span>;
  const isPositive = crescimento >= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-mono font-semibold tabular-nums",
        isPositive
          ? "text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
          : "text-rose-600 dark:text-rose-400 bg-rose-500/10"
      )}
    >
      {isPositive ? `+${pct(crescimento)}` : pct(crescimento)}
    </span>
  );
}

function hasOpenPipeline(row: EquipeDesempenhoLinha): boolean {
  return [row.oportunidade, row.cotacao, row.proposta].some((value) => asNumber(value) > 0);
}

function hasAnyActivity(row: EquipeDesempenhoLinha): boolean {
  return [
    row.oportunidade,
    row.cotacao,
    row.proposta,
    row.total,
    row.meta,
    row.total_venda,
    row.negocios,
    row.oportunidades_abertas,
    row.quantidade_vendas,
    row.clientes,
    row.prospeccao_maquina,
  ].some((v) => asNumber(v) > 0);
}

function aggregateConsultorRows(rows: EquipeDesempenhoLinha[]): EquipeDesempenhoLinha[] {
  const grouped = new Map<string, EquipeDesempenhoLinha[]>();
  for (const r of rows) {
    const name = r.consultor ?? "Sem consultor";
    let list = grouped.get(name);
    if (!list) {
      list = [];
      grouped.set(name, list);
    }
    list.push(r);
  }

  const result: EquipeDesempenhoLinha[] = [];
  grouped.forEach((cRows, consultor) => {
    const sorted = [...cRows].sort((a, b) => a.competencia.localeCompare(b.competencia));
    const lastRow = sorted[sorted.length - 1];

    let metaSum: number | null = null;
    let totalVenda = 0;
    let negocios = 0;
    let oportunidadesAbertas = 0;
    let quantidadeVendas = 0;
    let clientes = 0;
    let prospeccaoMaquina = 0;

    for (const r of cRows) {
      if (r.meta != null) {
        metaSum = (metaSum ?? 0) + Number(r.meta);
      }
      totalVenda += asNumber(r.total_venda);
      negocios += asNumber(r.negocios);
      oportunidadesAbertas += asNumber(r.oportunidades_abertas);
      quantidadeVendas += asNumber(r.quantidade_vendas);
      clientes += asNumber(r.clientes);
      prospeccaoMaquina += asNumber(r.prospeccao_maquina);
    }

    const desempenhoMeta =
      metaSum != null && metaSum > 0 ? Math.round((totalVenda / metaSum) * 1000) / 10 : null;
    const ticketMedio =
      negocios > 0 ? Math.round((totalVenda / negocios) * 100) / 100 : null;
    const taxaConversaoNegocios =
      negocios > 0 ? Math.round((quantidadeVendas / negocios) * 1000) / 10 : null;
    const taxaConversaoMaquina =
      prospeccaoMaquina > 0
        ? Math.round((quantidadeVendas / prospeccaoMaquina) * 1000) / 10
        : null;

    result.push({
      competencia: lastRow.competencia,
      consultor,
      oportunidade: lastRow.oportunidade,
      cotacao: lastRow.cotacao,
      proposta: lastRow.proposta,
      total: lastRow.total,
      crescimento_oportunidade: lastRow.crescimento_oportunidade,
      meta: metaSum,
      total_venda: totalVenda,
      desempenho_meta: desempenhoMeta,
      negocios,
      oportunidades_abertas: oportunidadesAbertas,
      quantidade_vendas: quantidadeVendas,
      ticket_medio: ticketMedio,
      clientes,
      taxa_conversao_negocios: taxaConversaoNegocios,
      prospeccao_maquina: prospeccaoMaquina,
      taxa_conversao_maquina: taxaConversaoMaquina,
    });
  });

  return result.sort((a, b) => (a.consultor ?? "").localeCompare(b.consultor ?? "", "pt-BR"));
}

function aggregateTeamRow(teamRows: EquipeDesempenhoLinha[]): EquipeDesempenhoLinha | null {
  if (teamRows.length === 0) return null;
  if (teamRows.length === 1) return teamRows[0];

  const sorted = [...teamRows].sort((a, b) => a.competencia.localeCompare(b.competencia));
  const lastRow = sorted[sorted.length - 1];

  let metaSum: number | null = null;
  let totalVenda = 0;
  let negocios = 0;
  let oportunidadesAbertas = 0;
  let quantidadeVendas = 0;
  let clientes = 0;
  let prospeccaoMaquina = 0;

  for (const r of teamRows) {
    if (r.meta != null) {
      metaSum = (metaSum ?? 0) + Number(r.meta);
    }
    totalVenda += asNumber(r.total_venda);
    negocios += asNumber(r.negocios);
    oportunidadesAbertas += asNumber(r.oportunidades_abertas);
    quantidadeVendas += asNumber(r.quantidade_vendas);
    clientes += asNumber(r.clientes);
    prospeccaoMaquina += asNumber(r.prospeccao_maquina);
  }

  const desempenhoMeta =
    metaSum != null && metaSum > 0 ? Math.round((totalVenda / metaSum) * 1000) / 10 : null;
  const ticketMedio =
    negocios > 0 ? Math.round((totalVenda / negocios) * 100) / 100 : null;
  const taxaConversaoNegocios =
    negocios > 0 ? Math.round((quantidadeVendas / negocios) * 1000) / 10 : null;
  const taxaConversaoMaquina =
    prospeccaoMaquina > 0
      ? Math.round((quantidadeVendas / prospeccaoMaquina) * 1000) / 10
      : null;

  return {
    competencia: lastRow.competencia,
    consultor: undefined,
    oportunidade: lastRow.oportunidade,
    cotacao: lastRow.cotacao,
    proposta: lastRow.proposta,
    total: lastRow.total,
    crescimento_oportunidade: lastRow.crescimento_oportunidade,
    meta: metaSum,
    total_venda: totalVenda,
    desempenho_meta: desempenhoMeta,
    negocios,
    oportunidades_abertas: oportunidadesAbertas,
    quantidade_vendas: quantidadeVendas,
    ticket_medio: ticketMedio,
    clientes,
    taxa_conversao_negocios: taxaConversaoNegocios,
    prospeccao_maquina: prospeccaoMaquina,
    taxa_conversao_maquina: taxaConversaoMaquina,
  };
}

const HEADERS_COLUMNS = [
  "Oport.",
  "Cotação",
  "Proposta",
  "Total Pipeline",
  "Cresc. Oport.",
  "Meta Mensal",
  "Total de Venda",
  "% Meta Mensal",
  "Negócios",
  "Oport. Abertas",
  "Qtd. Vendas",
  "Ticket Médio",
  "Qtde. Clientes",
  "Tx. Conv. Neg.",
  "Prospec. M.",
  "Tx. Conv. M.",
];

interface MetricRowProps {
  row: EquipeDesempenhoLinha;
  label: string;
  isTeam?: boolean;
  nested?: boolean;
  stickyMonth?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
  onSelectConsultor?: (nome: string) => void;
}

const MetricRow = memo(function MetricRow({
  row,
  label,
  isTeam = false,
  nested = false,
  stickyMonth = false,
  expanded = false,
  onToggle,
  onSelectConsultor,
}: MetricRowProps) {
  const monthCell = isTeam
    ? "bg-amber-500/[0.06] dark:bg-amber-500/[0.12]"
    : stickyMonth
    ? "sticky top-[41px] z-10 bg-[var(--surface-raised)]"
    : "";
  const firstCell = isTeam
    ? "sticky left-0 z-20 bg-[var(--surface-raised)] shadow-[1px_0_0_0_var(--voux-card-border)]"
    : stickyMonth
    ? "sticky top-[41px] left-0 z-20 bg-[var(--surface-raised)] shadow-[1px_0_0_0_var(--voux-card-border)]"
    : "sticky left-0 z-10 bg-[var(--surface-raised)] shadow-[1px_0_0_0_var(--voux-card-border)]";

  const percentMeta = row.desempenho_meta != null ? Math.min(Math.max(Number(row.desempenho_meta), 0), 100) : 0;

  return (
    <tr
      className={cn(
        "border-b text-[12px] transition-colors",
        isTeam
          ? "bg-amber-500/[0.05] dark:bg-amber-500/[0.1] font-bold hover:bg-amber-500/[0.08] dark:hover:bg-amber-500/[0.15]"
          : nested
          ? "bg-black/[0.01] dark:bg-white/[0.01] hover:bg-black/[0.03] dark:hover:bg-white/[0.03]"
          : "bg-[var(--surface-raised)] font-medium hover:bg-black/[0.02] dark:hover:bg-white/[0.02]"
      )}
      style={{ borderColor: "var(--voux-card-border)" }}
    >
      {/* Período / Consultor */}
      <td
        className={cn(
          firstCell,
          "whitespace-nowrap px-3.5 py-3 text-left font-medium"
        )}
        style={{ color: "var(--voux-text-heading)" }}
      >
        {isTeam ? (
          <div className="flex min-w-[170px] items-center gap-2 font-bold text-[13px]">
            <div className="flex h-5 w-5 items-center justify-center rounded bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Users className="h-3.5 w-3.5" />
            </div>
            <span className="font-bold text-[13px]">{label}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border border-amber-500/30 text-amber-600 dark:text-amber-400 bg-amber-500/10">
              equipe
            </span>
          </div>
        ) : onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex min-w-[170px] items-center gap-2 rounded text-left hover:text-amber-500 transition-colors group cursor-pointer"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-black/5 dark:bg-white/10 group-hover:bg-amber-500/20 text-muted-foreground group-hover:text-amber-500 transition-colors">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </div>
            <span className="font-bold text-[13px]">{label}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border text-muted-foreground">
              equipe
            </span>
          </button>
        ) : onSelectConsultor ? (
          <button
            type="button"
            onClick={() => onSelectConsultor(label)}
            className={cn(
              "flex min-w-[170px] items-center gap-2 text-left hover:text-amber-500 transition-colors group cursor-pointer",
              nested ? "pl-7 text-[12px]" : "text-[12px]"
            )}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500/70 group-hover:bg-amber-500 transition-colors" />
            <span className="truncate group-hover:underline">{label}</span>
          </button>
        ) : (
          <span className={cn("flex min-w-[170px] items-center gap-2 text-[12px]", nested ? "pl-7" : "")}>
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="truncate">{label}</span>
          </span>
        )}
      </td>

      {/* Oportunidade */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono text-muted-foreground")}>
        {money(row.oportunidade)}
      </td>

      {/* Cotação */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono text-muted-foreground")}>
        {money(row.cotacao)}
      </td>

      {/* Proposta */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono text-muted-foreground")}>
        {money(row.proposta)}
      </td>

      {/* Total Pipeline */}
      <td className={cn(monthCell, "px-3 py-3 text-right font-bold tabular-nums font-mono text-foreground")}>
        {money(row.total)}
      </td>

      {/* Crescimento Oportunidade */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums")}>
        {growthBadge(row.crescimento_oportunidade)}
      </td>

      {/* Meta */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono text-muted-foreground")}>
        {money(row.meta)}
      </td>

      {/* Total de Venda */}
      <td className={cn(monthCell, "px-3 py-3 text-right font-bold tabular-nums font-mono text-emerald-600 dark:text-emerald-400")}>
        {money(row.total_venda)}
      </td>

      {/* Desempenho da Meta com Mini Barra */}
      <td className={cn(monthCell, "px-3 py-3 text-right")}>
        <div className="flex flex-col items-end gap-1">
          {rateBadge(row.desempenho_meta)}
          {row.meta != null && asNumber(row.meta) > 0 && (
            <div className="h-1 w-16 overflow-hidden rounded-full bg-black/5 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all duration-300"
                style={{ width: `${percentMeta}%` }}
              />
            </div>
          )}
        </div>
      </td>

      {/* Negócios */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {NUMBER_FORMATTER.format(asNumber(row.negocios))}
      </td>

      {/* Oportunidades Abertas */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {NUMBER_FORMATTER.format(asNumber(row.oportunidades_abertas))}
      </td>

      {/* Quantidade Vendas */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono font-semibold text-emerald-600 dark:text-emerald-400")}>
        {NUMBER_FORMATTER.format(asNumber(row.quantidade_vendas))}
      </td>

      {/* Ticket Médio */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {money(row.ticket_medio)}
      </td>

      {/* Clientes */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {NUMBER_FORMATTER.format(asNumber(row.clientes))}
      </td>

      {/* Taxa Conversão Negócios */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {pct(row.taxa_conversao_negocios)}
      </td>

      {/* Prospecção Máquina */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {NUMBER_FORMATTER.format(asNumber(row.prospeccao_maquina))}
      </td>

      {/* Taxa Conversão Máquina */}
      <td className={cn(monthCell, "px-3 py-3 text-right font-bold tabular-nums font-mono text-sky-600 dark:text-sky-400")}>
        {pct(row.taxa_conversao_maquina)}
      </td>
    </tr>
  );
});

export const EquipeDesempenhoTable = memo(function EquipeDesempenhoTable({
  ano,
  data,
  isAdmin,
  filters,
  onSelectConsultor,
}: EquipeDesempenhoTableProps) {
  const [activeTab, setActiveTab] = useState<"principal" | "periodo">("principal");
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set());
  const [metasOpen, setMetasOpen] = useState(false);

  const { dateRange } = filters ?? {};
  const fromMonth = dateRange?.from ? dateRange.from.slice(0, 7) : null;
  const toMonth = dateRange?.to ? dateRange.to.slice(0, 7) : null;
  const currentIsoMonth = useMemo(() => new Date().toISOString().slice(0, 7), []);

  const targetPeriodInfo = useMemo(() => {
    if (fromMonth && toMonth) {
      if (fromMonth === toMonth) {
        return {
          type: "single" as const,
          yearMonth: fromMonth,
          label: formatMonthYear(fromMonth),
        };
      }
      return {
        type: "range" as const,
        fromMonth,
        toMonth,
        label: `${formatMonthYear(fromMonth)} a ${formatMonthYear(toMonth)}`,
      };
    }

    if (fromMonth) {
      return {
        type: "single" as const,
        yearMonth: fromMonth,
        label: formatMonthYear(fromMonth),
      };
    }

    const hasCurrentMonth = data.team.some((t) => t.competencia.startsWith(currentIsoMonth));
    if (hasCurrentMonth) {
      return {
        type: "single" as const,
        yearMonth: currentIsoMonth,
        label: formatMonthYear(currentIsoMonth),
      };
    }

    const latestCompetencia = data.team[data.team.length - 1]?.competencia ?? `${ano}-01-01`;
    const ym = latestCompetencia.slice(0, 7);
    return {
      type: "single" as const,
      yearMonth: ym,
      label: formatMonthYear(ym),
    };
  }, [fromMonth, toMonth, currentIsoMonth, data.team, ano]);

  const { principalRows, principalTeamRow } = useMemo(() => {
    if (targetPeriodInfo.type === "single") {
      const compPrefix = targetPeriodInfo.yearMonth;
      const rawRows = data.rows.filter((r) => r.competencia.startsWith(compPrefix));
      const teamRow = data.team.find((t) => t.competencia.startsWith(compPrefix));

      const sortedRows = rawRows
        .filter((r) => r.consultor && r.consultor !== "Sem consultor" && hasOpenPipeline(r))
        .sort((a, b) => (a.consultor ?? "").localeCompare(b.consultor ?? "", "pt-BR"));

      return {
        principalRows: sortedRows,
        principalTeamRow: teamRow ?? null,
      };
    } else {
      const startComp = `${targetPeriodInfo.fromMonth}-01`;
      const endComp = `${targetPeriodInfo.toMonth}-31`;

      const rowsInRange = data.rows.filter(
        (r) => r.competencia >= startComp && r.competencia <= endComp
      );
      const teamInRange = data.team.filter(
        (t) => t.competencia >= startComp && t.competencia <= endComp
      );

      const aggregatedConsultors = aggregateConsultorRows(rowsInRange).filter(hasOpenPipeline);
      const aggregatedTeam = aggregateTeamRow(teamInRange);

      return {
        principalRows: aggregatedConsultors,
        principalTeamRow: aggregatedTeam,
      };
    }
  }, [targetPeriodInfo, data.rows, data.team]);

  const consultores = useMemo(
    () =>
      Array.from(
        new Set(
          data.rows
            .filter(hasOpenPipeline)
            .map((row) => row.consultor)
            .filter((name): name is string => !!name)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [data.rows]
  );

  const consultoresPorMes = useMemo(() => {
    const grouped = new Map<string, EquipeDesempenhoLinha[]>();
    for (const row of data.rows) {
      let rows = grouped.get(row.competencia);
      if (!rows) {
        rows = [];
        grouped.set(row.competencia, rows);
      }
      rows.push(row);
    }
    grouped.forEach((rows, competencia) => {
      grouped.set(
        competencia,
        rows
          .filter(hasOpenPipeline)
          .sort((a, b) => (a.consultor ?? "").localeCompare(b.consultor ?? "", "pt-BR"))
      );
    });
    return grouped;
  }, [data.rows]);

  const toggleMonth = (competencia: string) => {
    setExpandedMonths((current) => {
      const next = new Set(current);
      if (next.has(competencia)) next.delete(competencia);
      else next.add(competencia);
      return next;
    });
  };

  return (
    <div
      className="rounded-2xl border p-5 transition-all duration-200"
      style={{
        background: "var(--surface-raised)",
        borderColor: "var(--voux-card-border)",
        boxShadow: "var(--voux-card-shadow)",
      }}
    >
      <Tabs
        value={activeTab}
        onValueChange={(val) => setActiveTab(val as "principal" | "periodo")}
        className="w-full"
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-amber-500 dark:text-amber-400" />
              <h3
                className="text-[11px] font-semibold uppercase tracking-[0.14em]"
                style={{ fontFamily: "var(--voux-font-mono)", color: "var(--voux-text-muted)" }}
              >
                Análise de Desempenho da Equipe
              </h3>
            </div>
            <p className="mt-1 text-[13px] text-muted-foreground">
              {activeTab === "principal" ? (
                <>
                  Acompanhamento por consultor no período selecionado ·{" "}
                  <span className="font-mono font-bold text-foreground">{targetPeriodInfo.label}</span>
                </>
              ) : (
                <>
                  Acompanhamento mensal matricial consolidado e por consultor ·{" "}
                  <span className="font-mono font-bold text-foreground">{ano}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <TabsList className="h-8 bg-black/5 dark:bg-white/5 border border-border/40 p-0.5 rounded-lg text-[12px]">
              <TabsTrigger
                value="principal"
                onClick={() => setActiveTab("principal")}
                className="h-7 px-3 text-[12px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all gap-1.5"
              >
                <Users className="h-3.5 w-3.5" />
                <span>Principal</span>
              </TabsTrigger>
              <TabsTrigger
                value="periodo"
                onClick={() => setActiveTab("periodo")}
                className="h-7 px-3 text-[12px] font-medium data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm rounded-md transition-all gap-1.5"
              >
                <CalendarDays className="h-3.5 w-3.5" />
                <span>Visão por Período</span>
              </TabsTrigger>
            </TabsList>

            {isAdmin && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setMetasOpen(true)}
                className="h-8 gap-1.5 text-[12px] font-mono border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600 dark:hover:text-amber-300"
              >
                <Settings2 className="h-3.5 w-3.5" /> Metas
              </Button>
            )}
          </div>
        </div>

        {/* Tab 1: Visão Principal (Por Consultor no Mês/Período) */}
        <TabsContent value="principal" className="m-0 focus-visible:outline-none">
          <div
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--voux-card-border)",
              background: "var(--surface-base)",
              transform: "translateZ(0)",
            }}
          >
            <div className="max-h-[min(70vh,620px)] overflow-auto will-change-scroll">
              <table className="w-full min-w-[2000px] text-[12px]" style={{ fontFamily: "var(--voux-font-sans)" }}>
                <thead>
                  <tr
                    className="border-b bg-black/[0.03] dark:bg-white/[0.04]"
                    style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-faint)", fontFamily: "var(--voux-font-mono)" }}
                  >
                    <th
                      className="sticky top-0 left-0 z-30 whitespace-nowrap bg-[var(--surface-raised)] px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[1px_1px_0_0_var(--voux-card-border)]"
                    >
                      Consultor
                    </th>
                    {HEADERS_COLUMNS.map((header) => (
                      <th
                        key={header}
                        className="sticky top-0 z-20 whitespace-nowrap bg-[var(--surface-raised)] px-3.5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[0_1px_0_0_var(--voux-card-border)]"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {principalTeamRow && (
                    <MetricRow
                      row={principalTeamRow}
                      label="TOTAL DA EQUIPE"
                      isTeam
                    />
                  )}
                  {principalRows.length > 0 ? (
                    principalRows.map((consultorRow) => (
                      <MetricRow
                        key={`principal-${consultorRow.consultor}`}
                        row={consultorRow}
                        label={consultorRow.consultor ?? "Sem consultor"}
                        onSelectConsultor={onSelectConsultor}
                      />
                    ))
                  ) : (
                    <tr>
                      <td colSpan={17} className="text-center py-10 text-muted-foreground font-mono text-[12px]">
                        Nenhum registro de consultores encontrado para {targetPeriodInfo.label}.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Footnote */}
            <div
              className="border-t px-4 py-2.5 text-[11px] flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-faint)" }}
            >
              <span>
                Negócios = oportunidades geradas no período · Tx. Conv. Neg. = qtd. de vendas ÷ negócios gerados · Tx. Conv. M. = qtd. de vendas ÷ clientes com Prospecção Maq.
              </span>
              <span className="font-mono text-muted-foreground">
                {principalRows.length} consultores {targetPeriodInfo.type === "single" ? `em ${targetPeriodInfo.label}` : "no período"}
              </span>
            </div>
          </div>
        </TabsContent>

        {/* Tab 2: Visão por Período (Evolução Mensal com meses expansíveis) */}
        <TabsContent value="periodo" className="m-0 focus-visible:outline-none">
          <div
            className="overflow-hidden rounded-xl border"
            style={{
              borderColor: "var(--voux-card-border)",
              background: "var(--surface-base)",
              transform: "translateZ(0)",
            }}
          >
            <div className="max-h-[min(70vh,620px)] overflow-auto will-change-scroll">
              <table className="w-full min-w-[2000px] text-[12px]" style={{ fontFamily: "var(--voux-font-sans)" }}>
                <thead>
                  <tr
                    className="border-b bg-black/[0.03] dark:bg-white/[0.04]"
                    style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-faint)", fontFamily: "var(--voux-font-mono)" }}
                  >
                    <th
                      className="sticky top-0 left-0 z-30 whitespace-nowrap bg-[var(--surface-raised)] px-3.5 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[1px_1px_0_0_var(--voux-card-border)]"
                    >
                      Período
                    </th>
                    {HEADERS_COLUMNS.map((header) => (
                      <th
                        key={header}
                        className="sticky top-0 z-20 whitespace-nowrap bg-[var(--surface-raised)] px-3.5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[0_1px_0_0_var(--voux-card-border)]"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.team.map((teamRow) => {
                    const isExpanded = expandedMonths.has(teamRow.competencia);
                    const rowsDoMes = consultoresPorMes.get(teamRow.competencia) ?? [];
                    return (
                      <Fragment key={`team-${teamRow.competencia}`}>
                        <MetricRow
                          row={teamRow}
                          label={formatMonthYear(teamRow.competencia.slice(0, 7))}
                          stickyMonth
                          expanded={isExpanded}
                          onToggle={() => toggleMonth(teamRow.competencia)}
                        />
                        {isExpanded &&
                          rowsDoMes.map((consultorRow) => (
                            <MetricRow
                              key={`${consultorRow.consultor}-${consultorRow.competencia}`}
                              row={consultorRow}
                              label={consultorRow.consultor ?? "Sem consultor"}
                              nested
                              onSelectConsultor={onSelectConsultor}
                            />
                          ))}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Footnote */}
            <div
              className="border-t px-4 py-2.5 text-[11px] flex flex-wrap items-center justify-between gap-2"
              style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-faint)" }}
            >
              <span>
                Negócios = oportunidades geradas no mês · Tx. Conv. Neg. = qtd. de vendas ÷ negócios gerados · Tx. Conv. M. = qtd. de vendas ÷ clientes com Prospecção Maq.
              </span>
              <span className="font-mono text-muted-foreground">Clique no mês para expandir os consultores</span>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {isAdmin && (
        <div
          className="mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-[11px]"
          style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-muted)" }}
        >
          <Target className="h-3.5 w-3.5 shrink-0 text-amber-500" />
          <span>A meta anual é distribuída em metas mensais por consultor; somente administradores podem alterá-las.</span>
        </div>
      )}

      <MetasEquipeDialog
        open={metasOpen}
        onOpenChange={setMetasOpen}
        ano={ano}
        consultores={consultores}
      />
    </div>
  );
});
