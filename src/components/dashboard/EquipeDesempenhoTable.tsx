import { Fragment, useMemo, useState } from "react";
import { ChevronDown, ChevronRight, Settings2, Target, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBRL, formatMonthYear } from "@/lib/dateUtils";
import type { EquipeDesempenhoData, EquipeDesempenhoLinha } from "@/types/equipeDesempenho";
import { MetasEquipeDialog } from "./MetasEquipeDialog";
import { cn } from "@/lib/utils";

interface EquipeDesempenhoTableProps {
  ano: number;
  data: EquipeDesempenhoData;
  isAdmin: boolean;
}

function asNumber(value: number | null | undefined): number {
  return Number(value ?? 0);
}

function pct(value: number | null | undefined): string {
  return value == null ? "—" : `${Number(value).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}%`;
}

function money(value: number | null | undefined): string {
  return value == null ? "—" : formatBRL(asNumber(value));
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

/**
 * A expansão mensal é uma leitura do funil aberto. Só lista consultores com
 * valor em ao menos uma das três etapas: oportunidade, cotação ou proposta.
 */
function hasOpenPipeline(row: EquipeDesempenhoLinha): boolean {
  return [row.oportunidade, row.cotacao, row.proposta].some((value) => asNumber(value) !== 0);
}

interface MetricRowProps {
  row: EquipeDesempenhoLinha;
  label: string;
  nested?: boolean;
  stickyMonth?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}

function MetricRow({
  row,
  label,
  nested = false,
  stickyMonth = false,
  expanded = false,
  onToggle,
}: MetricRowProps) {
  const monthCell = stickyMonth ? "sticky top-[41px] z-10 bg-[var(--surface-raised)] backdrop-blur-md" : "";
  const firstCell = stickyMonth
    ? "sticky top-[41px] left-0 z-20 bg-[var(--surface-raised)] backdrop-blur-md shadow-[1px_0_0_0_var(--voux-card-border)]"
    : "sticky left-0 z-10 bg-[var(--surface-raised)] backdrop-blur-md shadow-[1px_0_0_0_var(--voux-card-border)]";

  const percentMeta = row.desempenho_meta != null ? Math.min(Math.max(Number(row.desempenho_meta), 0), 100) : 0;

  return (
    <tr
      className={cn(
        "border-b text-[12px] transition-colors",
        nested
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
        {onToggle ? (
          <button
            type="button"
            onClick={onToggle}
            aria-expanded={expanded}
            className="flex min-w-[170px] items-center gap-2 rounded text-left hover:text-amber-500 transition-colors group"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded bg-black/5 dark:bg-white/10 group-hover:bg-amber-500/20 text-muted-foreground group-hover:text-amber-500 transition-colors">
              {expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
            </div>
            <span className="font-bold text-[13px]">{label}</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full border text-muted-foreground">
              equipe
            </span>
          </button>
        ) : (
          <span className="flex min-w-[170px] items-center gap-2 pl-7 text-[12px]">
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
        {asNumber(row.negocios).toLocaleString("pt-BR")}
      </td>

      {/* Oportunidades Abertas */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {asNumber(row.oportunidades_abertas).toLocaleString("pt-BR")}
      </td>

      {/* Quantidade Vendas */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono font-semibold text-emerald-600 dark:text-emerald-400")}>
        {asNumber(row.quantidade_vendas).toLocaleString("pt-BR")}
      </td>

      {/* Ticket Médio */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {money(row.ticket_medio)}
      </td>

      {/* Clientes */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {asNumber(row.clientes).toLocaleString("pt-BR")}
      </td>

      {/* Taxa Conversão Negócios */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {pct(row.taxa_conversao_negocios)}
      </td>

      {/* Prospecção Máquina */}
      <td className={cn(monthCell, "px-3 py-3 text-right tabular-nums font-mono")}>
        {asNumber(row.prospeccao_maquina).toLocaleString("pt-BR")}
      </td>

      {/* Taxa Conversão Máquina */}
      <td className={cn(monthCell, "px-3 py-3 text-right font-bold tabular-nums font-mono text-sky-600 dark:text-sky-400")}>
        {pct(row.taxa_conversao_maquina)}
      </td>
    </tr>
  );
}

export function EquipeDesempenhoTable({ ano, data, isAdmin }: EquipeDesempenhoTableProps) {
  const [expandedMonths, setExpandedMonths] = useState<Set<string>>(() => new Set());
  const [metasOpen, setMetasOpen] = useState(false);

  const consultores = useMemo(
    () =>
      Array.from(
        new Set(data.rows.map((row) => row.consultor).filter((name): name is string => !!name))
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [data.rows]
  );

  const consultoresPorMes = useMemo(() => {
    const grouped = new Map<string, EquipeDesempenhoLinha[]>();
    data.rows.forEach((row) => {
      const rows = grouped.get(row.competencia) ?? [];
      rows.push(row);
      grouped.set(row.competencia, rows);
    });
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
            Acompanhamento mensal matricial consolidado e por consultor · <span className="font-mono font-bold text-foreground">{ano}</span>
          </p>
        </div>

        <div className="flex items-center gap-2">
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

      {/* Table Container */}
      <div
        className="overflow-hidden rounded-xl border"
        style={{ borderColor: "var(--voux-card-border)", background: "var(--surface-base)" }}
      >
        <div className="max-h-[min(70vh,620px)] overflow-auto">
          <table className="w-full min-w-[2000px] text-[12px]" style={{ fontFamily: "var(--voux-font-sans)" }}>
            <thead>
              <tr
                className="border-b bg-black/[0.03] dark:bg-white/[0.04]"
                style={{ borderColor: "var(--voux-card-border)", color: "var(--voux-text-faint)", fontFamily: "var(--voux-font-mono)" }}
              >
                {[
                  "Período",
                  "Oport.",
                  "Cotação",
                  "Proposta",
                  "Total Pipeline",
                  "Cresc. Oport.",
                  "Meta",
                  "Total de Venda",
                  "Desemp. Meta",
                  "Negócios",
                  "Oport. Abertas",
                  "Qtd. Vendas",
                  "Ticket Médio",
                  "Qtde. Clientes",
                  "Tx. Conv. Neg.",
                  "Prospec. M.",
                  "Tx. Conv. M.",
                ].map((header, index) => (
                  <th
                    key={header}
                    className={cn(
                      "sticky top-0 z-20 whitespace-nowrap bg-[var(--surface-raised)] backdrop-blur-md px-3.5 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.08em] shadow-[0_1px_0_0_var(--voux-card-border)]",
                      index === 0 && "left-0 z-30 text-left shadow-[1px_1px_0_0_var(--voux-card-border)]"
                    )}
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
        rows={data.rows}
      />
    </div>
  );
}
