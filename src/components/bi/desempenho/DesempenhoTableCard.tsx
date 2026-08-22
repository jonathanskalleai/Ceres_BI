import React, { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export interface DesempenhoTableRow {
  name: string;
  subtitle?: string;
  qtd: number;
  percent?: number;
  ticketMedio: number;
  valor: number;
}

interface DesempenhoTableCardProps {
  eyebrow: string;
  title: string;
  firstColumnHeader?: string;
  showPercent?: boolean;
  rows: DesempenhoTableRow[];
  loading?: boolean;
  emptyMessage?: string;
  maxDisplayRows?: number;
  className?: string;
}

export const DesempenhoTableCard: React.FC<DesempenhoTableCardProps> = ({
  eyebrow,
  title,
  firstColumnHeader = "ITEM",
  showPercent = true,
  rows,
  loading = false,
  emptyMessage = "Nenhum registro encontrado no período selecionado.",
  maxDisplayRows = 10,
  className,
}) => {
  const [expanded, setExpanded] = useState(false);
  const displayRows = expanded ? rows : rows.slice(0, maxDisplayRows);

  // Calcula o valor máximo de ticket médio para a barra proporcional de background
  const maxTicket = Math.max(...displayRows.map((r) => r.ticketMedio), 1);
  const totalQtd = rows.reduce((acc, r) => acc + r.qtd, 0);
  const totalValor = rows.reduce((acc, r) => acc + r.valor, 0);
  const totalTicketMedio = totalQtd > 0 ? totalValor / totalQtd : 0;

  const hasMoreRows = rows.length > maxDisplayRows;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Header no estilo do exemplo */}
        <div className="flex items-start justify-between gap-2 mb-4">
          <div>
            <p
              className="text-[10px] font-bold tracking-[0.2em] uppercase text-[var(--voux-text-muted)]"
              style={{ fontFamily: "var(--voux-font-mono)" }}
            >
              {eyebrow}
            </p>
            <h2
              className="text-[18px] md:text-[20px] font-bold tracking-tight text-[var(--voux-text-heading)] mt-0.5"
              style={{ fontFamily: "var(--voux-font-display)" }}
            >
              {title}
            </h2>
          </div>

          {hasMoreRows && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--voux-card-border)] text-[11px] font-medium text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)] hover:bg-[var(--voux-card-border)]/20 transition-all shrink-0 mt-1"
            >
              <span>{expanded ? "Ver menos" : `Ver todos (${rows.length})`}</span>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}
        </div>

        {/* Loading State */}
        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-6 w-full rounded bg-[var(--voux-skeleton)]" />
            <Skeleton className="h-8 w-full rounded bg-[var(--voux-skeleton)]" />
            <Skeleton className="h-8 w-full rounded bg-[var(--voux-skeleton)]" />
            <Skeleton className="h-8 w-full rounded bg-[var(--voux-skeleton)]" />
            <Skeleton className="h-8 w-full rounded bg-[var(--voux-skeleton)]" />
          </div>
        ) : displayRows.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--voux-text-muted)]">
            {emptyMessage}
          </div>
        ) : (
          /* Table Container */
          <div className="overflow-x-auto -mx-2 px-2 max-h-[420px] overflow-y-auto sidebar-scroll">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 bg-[var(--voux-card-from)] z-10">
                <tr className="border-b border-[var(--voux-card-border)] text-[10px] font-bold tracking-wider text-[var(--voux-text-muted)] uppercase">
                  <th className="py-2.5 pr-4 font-semibold">{firstColumnHeader}</th>
                  <th className="py-2.5 px-3 text-right font-semibold">QTD</th>
                  {showPercent && <th className="py-2.5 px-3 text-right font-semibold">%</th>}
                  <th className="py-2.5 px-3 text-right font-semibold">TICKET MÉDIO</th>
                  <th className="py-2.5 pl-3 text-right font-semibold">VALOR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--voux-card-border)]/60">
                {displayRows.map((row, idx) => {
                  const ticketPercent = Math.min(100, Math.round((row.ticketMedio / maxTicket) * 100));

                  return (
                    <tr
                      key={`${row.name}-${idx}`}
                      className="group hover:bg-[var(--voux-card-border)]/30 transition-colors"
                    >
                      {/* Nome / Título */}
                      <td className="py-3 pr-4 max-w-[220px]">
                        <p className="font-semibold text-[13px] text-[var(--voux-text-primary)] uppercase truncate" title={row.name}>
                          {row.name}
                        </p>
                        {row.subtitle && (
                          <p className="text-[10px] text-[var(--voux-text-muted)] truncate">
                            {row.subtitle}
                          </p>
                        )}
                      </td>

                      {/* Quantidade */}
                      <td className="py-3 px-3 text-right tabular-nums font-mono font-medium text-[13px] text-[var(--voux-text-primary)]">
                        {row.qtd.toLocaleString("pt-BR")}
                      </td>

                      {/* % Participação */}
                      {showPercent && (
                        <td className="py-3 px-3 text-right tabular-nums font-mono text-[12px] text-[var(--voux-text-muted)]">
                          {row.percent != null ? `${row.percent.toFixed(1)}%` : "—"}
                        </td>
                      )}

                      {/* Ticket Médio com barra visual suave */}
                      <td className="py-2 px-3 text-right relative">
                        <div className="relative inline-flex items-center justify-end w-full min-w-[110px] px-2 py-1 rounded">
                          {/* Barra de magnitude visual sutil */}
                          <div
                            className="absolute right-0 top-0 bottom-0 rounded bg-emerald-500/15 dark:bg-emerald-500/20 pointer-events-none transition-all duration-300"
                            style={{ width: `${ticketPercent}%` }}
                          />
                          <span className="relative z-10 font-mono text-[12px] font-medium text-[var(--voux-text-primary)]">
                            {formatBRL(row.ticketMedio)}
                          </span>
                        </div>
                      </td>

                      {/* Valor Total em verde de destaque */}
                      <td className="py-3 pl-3 text-right tabular-nums font-mono text-[13px] font-semibold text-emerald-700 dark:text-emerald-400">
                        {formatBRL(row.valor)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Footer com Totais Conciliados */}
      {!loading && displayRows.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--voux-card-border)] flex items-center justify-between text-[11px] text-[var(--voux-text-muted)]">
          <span className="font-medium">
            Total Geral ({totalQtd.toLocaleString("pt-BR")} pedidos):
          </span>
          <div className="flex items-center gap-4 font-mono">
            <span><strong>{totalQtd.toLocaleString("pt-BR")}</strong> un</span>
            <span>Méd: <strong>{formatBRL(totalTicketMedio)}</strong></span>
            <span className="font-semibold text-emerald-700 dark:text-emerald-400">{formatBRL(totalValor)}</span>
          </div>
        </div>
      )}
    </div>
  );
};
