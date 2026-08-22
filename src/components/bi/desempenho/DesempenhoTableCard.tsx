import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

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
  variant?: "emerald" | "red";
  unitLabel?: string;
  selectedItemName?: string | null;
  onRowClick?: (row: DesempenhoTableRow) => void;
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
  variant = "emerald",
  unitLabel,
  selectedItemName,
  onRowClick,
  className,
}) => {
  const isRed = variant === "red";

  // Calcula limites para o Mapa de Calor (Heatmap) de Ticket Médio
  const validTickets = rows.map((r) => r.ticketMedio).filter((v) => v > 0);
  const minTicket = validTickets.length > 0 ? Math.min(...validTickets) : 0;
  const maxTicket = Math.max(...rows.map((r) => r.ticketMedio), 1);

  const totalQtd = rows.reduce((acc, r) => acc + r.qtd, 0);
  const totalValor = rows.reduce((acc, r) => acc + r.valor, 0);
  const totalTicketMedio = totalQtd > 0 ? totalValor / totalQtd : 0;

  const defaultUnit = isRed ? "negócios perdidos" : "pedidos";
  const finalUnitLabel = unitLabel || defaultUnit;

  const hasSelectionInThisCard = Boolean(
    selectedItemName && rows.some((r) => r.name.toLowerCase() === selectedItemName.toLowerCase())
  );

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Header no estilo editorial limpo */}
        <div className="mb-4 flex items-start justify-between gap-2">
          <div>
            <p
              className={cn(
                "text-[10px] font-bold tracking-[0.2em] uppercase font-mono",
                isRed ? "text-red-600 dark:text-red-400" : "text-[var(--voux-text-muted)]"
              )}
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

          {onRowClick && (
            <span className="text-[10px] text-[var(--voux-text-muted)] font-sans hidden sm:inline-block">
              Clique para filtrar
            </span>
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
        ) : rows.length === 0 ? (
          <div className="py-8 text-center text-xs text-[var(--voux-text-muted)]">
            {emptyMessage}
          </div>
        ) : (
          /* Table Container com Rolagem Suave Direta, Zoom Frontal, Filtro Interativo e Heatmap */
          <div className="overflow-x-auto -mx-2 px-2 max-h-[380px] overflow-y-auto sidebar-scroll pr-1">
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
                {rows.map((row, idx) => {
                  // Intensidade de calor de 0 a 1
                  const intensity =
                    maxTicket > minTicket
                      ? Math.max(0, Math.min(1, (row.ticketMedio - minTicket) / (maxTicket - minTicket)))
                      : 0.5;

                  // Alfa proporcional para o fundo (0.08 a 0.32)
                  const bgAlpha = (0.08 + intensity * 0.24).toFixed(3);
                  const isHighIntensity = intensity >= 0.55;

                  const isSelected = Boolean(
                    selectedItemName && row.name.toLowerCase() === selectedItemName.toLowerCase()
                  );

                  return (
                    <tr
                      key={`${row.name}-${idx}`}
                      onClick={() => onRowClick && onRowClick(row)}
                      className={cn(
                        "group transition-all duration-200 cursor-pointer relative",
                        isSelected
                          ? isRed
                            ? "bg-red-500/15 border-l-4 border-l-red-600 dark:bg-red-950/40 shadow-sm z-20 font-bold scale-[1.01]"
                            : "bg-emerald-500/15 border-l-4 border-l-emerald-600 dark:bg-emerald-950/40 shadow-sm z-20 font-bold scale-[1.01]"
                          : hasSelectionInThisCard
                            ? "opacity-60 hover:opacity-100 hover:scale-[1.015] hover:-translate-y-[1px]"
                            : "hover:scale-[1.018] hover:-translate-y-[1.5px] hover:z-30 hover:bg-[var(--surface-raised)]/95 hover:backdrop-blur-md hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.12)] dark:hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.45)] hover:ring-1",
                        !isSelected && (isRed ? "hover:ring-red-500/40" : "hover:ring-emerald-500/40")
                      )}
                    >
                      {/* Nome / Título */}
                      <td className="py-3 pr-4 max-w-[220px]">
                        <div className="flex items-center gap-1.5 min-w-0">
                          {isSelected && (
                            <span
                              className={cn(
                                "h-4 w-4 rounded-full flex items-center justify-center text-white shrink-0",
                                isRed ? "bg-red-600" : "bg-emerald-600"
                              )}
                            >
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                          <div className="truncate">
                            <p
                              className={cn(
                                "font-semibold text-[13px] uppercase truncate transition-colors",
                                isSelected
                                  ? isRed
                                    ? "text-red-700 dark:text-red-300"
                                    : "text-emerald-800 dark:text-emerald-300"
                                  : "text-[var(--voux-text-primary)] group-hover:text-[var(--voux-text-heading)]"
                              )}
                              title={row.name}
                            >
                              {row.name}
                            </p>
                            {row.subtitle && (
                              <p className="text-[10px] text-[var(--voux-text-muted)] truncate">
                                {row.subtitle}
                              </p>
                            )}
                          </div>
                        </div>
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

                      {/* Ticket Médio com Mapa de Calor (Heatmap Pill Completo) */}
                      <td className="py-2 px-3 text-right">
                        <div
                          className={cn(
                            "inline-flex items-center justify-end w-full min-w-[110px] px-2.5 py-1 rounded-xl transition-all duration-200 font-mono text-[12px]",
                            isHighIntensity
                              ? isRed
                                ? "text-red-700 dark:text-red-300 font-bold"
                                : "text-emerald-800 dark:text-emerald-300 font-bold"
                              : "text-[var(--voux-text-primary)] font-medium"
                          )}
                          style={{
                            backgroundColor: isRed
                              ? `rgba(220, 38, 38, ${bgAlpha})`
                              : `rgba(45, 106, 79, ${bgAlpha})`,
                          }}
                        >
                          <span>{formatBRL(row.ticketMedio)}</span>
                        </div>
                      </td>

                      {/* Valor Total */}
                      <td
                        className={cn(
                          "py-3 pl-3 text-right tabular-nums font-mono text-[13px] font-semibold transition-colors",
                          isRed
                            ? "text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 font-bold"
                            : "text-emerald-700 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 font-bold"
                        )}
                      >
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
      {!loading && rows.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--voux-card-border)] flex items-center justify-between text-[11px] text-[var(--voux-text-muted)]">
          <span className="font-medium">
            Total ({totalQtd.toLocaleString("pt-BR")} {finalUnitLabel}):
          </span>
          <div className="flex items-center gap-4 font-mono">
            <span><strong>{totalQtd.toLocaleString("pt-BR")}</strong> un</span>
            <span>Méd: <strong>{formatBRL(totalTicketMedio)}</strong></span>
            <span
              className={cn(
                "font-semibold",
                isRed ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"
              )}
            >
              {formatBRL(totalValor)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
