import React from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBRL } from "@/lib/dateUtils";
import { cn } from "@/lib/utils";

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
  className,
}) => {
  const isRed = variant === "red";

  // Calcula o valor máximo de ticket médio para a barra proporcional de background
  const maxTicket = Math.max(...rows.map((r) => r.ticketMedio), 1);
  const totalQtd = rows.reduce((acc, r) => acc + r.qtd, 0);
  const totalValor = rows.reduce((acc, r) => acc + r.valor, 0);
  const totalTicketMedio = totalQtd > 0 ? totalValor / totalQtd : 0;

  const defaultUnit = isRed ? "negócios perdidos" : "pedidos";
  const finalUnitLabel = unitLabel || defaultUnit;

  return (
    <div
      className={cn(
        "rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] p-5 md:p-6 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between",
        className
      )}
    >
      <div>
        {/* Header no estilo editorial limpo */}
        <div className="mb-4">
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
          /* Table Container com Rolagem Suave e Efeito Vidro Fosco Flutuante Real no Hover */
          <div className="max-h-[380px] overflow-y-auto sidebar-scroll pr-1 -mx-1 px-1">
            {/* Cabeçalho */}
            <div
              className={cn(
                "grid items-center gap-2 px-3 py-2 border-b border-[var(--voux-card-border)] text-[10px] font-bold tracking-wider text-[var(--voux-text-muted)] uppercase sticky top-0 bg-[var(--voux-card-from)] z-10",
                showPercent
                  ? "grid-cols-[1fr_52px_48px_110px_110px]"
                  : "grid-cols-[1fr_60px_120px_120px]"
              )}
            >
              <span>{firstColumnHeader}</span>
              <span className="text-right">QTD</span>
              {showPercent && <span className="text-right">%</span>}
              <span className="text-right">TICKET MÉDIO</span>
              <span className="text-right">VALOR</span>
            </div>

            {/* Linhas Interativas com Efeito Vidro Fosco & Zoom Frontal */}
            <div className="space-y-1.5 pt-1.5 pb-2">
              {rows.map((row, idx) => {
                const ticketPercent = Math.min(100, Math.round((row.ticketMedio / maxTicket) * 100));

                return (
                  <div
                    key={`${row.name}-${idx}`}
                    className={cn(
                      "group grid items-center gap-2 px-3.5 py-2.5 rounded-2xl transition-all duration-200 cursor-pointer relative",
                      showPercent
                        ? "grid-cols-[1fr_52px_48px_110px_110px]"
                        : "grid-cols-[1fr_60px_120px_120px]",
                      // Estado em repouso
                      "bg-[var(--voux-surface)]/40 border border-[var(--voux-card-border)]/40",
                      // Efeito Vidro Fosco Flutuante no Hover (Idêntico ao Tooltip do Gráfico)
                      "hover:scale-[1.018] hover:-translate-y-1 hover:z-30",
                      "hover:bg-white/80 dark:hover:bg-[#15212b]/85 hover:backdrop-blur-xl hover:backdrop-saturate-150",
                      "hover:border-white/90 dark:hover:border-white/25",
                      "hover:shadow-[0_12px_30px_-6px_rgba(0,0,0,0.14),0_0_0_1px_rgba(255,255,255,0.6)] dark:hover:shadow-[0_16px_36px_-6px_rgba(0,0,0,0.55),0_0_0_1px_rgba(255,255,255,0.12)]"
                    )}
                  >
                    {/* Nome / Título */}
                    <div className="min-w-0 pr-1">
                      <p
                        className="font-semibold text-[13px] text-[var(--voux-text-primary)] uppercase truncate group-hover:text-[var(--voux-text-heading)] transition-colors"
                        title={row.name}
                      >
                        {row.name}
                      </p>
                      {row.subtitle && (
                        <p className="text-[10px] text-[var(--voux-text-muted)] truncate mt-0.5">
                          {row.subtitle}
                        </p>
                      )}
                    </div>

                    {/* Quantidade */}
                    <div className="text-right tabular-nums font-mono font-medium text-[13px] text-[var(--voux-text-primary)]">
                      {row.qtd.toLocaleString("pt-BR")}
                    </div>

                    {/* % Participação */}
                    {showPercent && (
                      <div className="text-right tabular-nums font-mono text-[12px] text-[var(--voux-text-muted)]">
                        {row.percent != null ? `${row.percent.toFixed(1)}%` : "—"}
                      </div>
                    )}

                    {/* Ticket Médio com barra visual suave */}
                    <div className="text-right relative">
                      <div className="relative inline-flex items-center justify-end w-full px-2 py-1 rounded-lg">
                        <div
                          className={cn(
                            "absolute right-0 top-0 bottom-0 rounded-lg pointer-events-none transition-all duration-300",
                            isRed
                              ? "bg-red-500/15 dark:bg-red-500/25 group-hover:bg-red-500/25"
                              : "bg-emerald-500/15 dark:bg-emerald-500/20 group-hover:bg-emerald-500/25"
                          )}
                          style={{ width: `${ticketPercent}%` }}
                        />
                        <span className="relative z-10 font-mono text-[12px] font-medium text-[var(--voux-text-primary)]">
                          {formatBRL(row.ticketMedio)}
                        </span>
                      </div>
                    </div>

                    {/* Valor Total */}
                    <div
                      className={cn(
                        "text-right tabular-nums font-mono text-[13px] font-semibold transition-colors",
                        isRed
                          ? "text-red-600 dark:text-red-400 group-hover:text-red-700 dark:group-hover:text-red-300 font-bold"
                          : "text-emerald-700 dark:text-emerald-400 group-hover:text-emerald-800 dark:group-hover:text-emerald-300 font-bold"
                      )}
                    >
                      {formatBRL(row.valor)}
                    </div>
                  </div>
                );
              })}
            </div>
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
