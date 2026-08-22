import React from "react";
import { X, TrendingUp, TrendingDown, RefreshCw, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { type DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";

export type DesempenhoTab = "ganhos" | "perdas";

export interface ActiveCrossFilter {
  type: "vendedor" | "produto" | "cidade" | "origem" | "banco" | "motivo";
  label: string;
  value: string;
}

interface DesempenhoFilterBarProps {
  activeTab: DesempenhoTab;
  onTabChange: (tab: DesempenhoTab) => void;
  ano: number | null;
  onAnoChange: (ano: number | null) => void;
  dateRange?: DateRange;
  onDateRangeChange: (range?: DateRange) => void;
  vendedor: string;
  onVendedorChange: (vendedor: string) => void;
  vendedorOptions: string[];
  cidade: string;
  onCidadeChange: (cidade: string) => void;
  cidadeOptions: string[];
  activeCrossFilter?: ActiveCrossFilter | null;
  onClearCrossFilter?: () => void;
  onResetFilters: () => void;
  hasActiveFilters: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

const AVAILABLE_YEARS = [2026, 2025, 2024];

export const DesempenhoFilterBar: React.FC<DesempenhoFilterBarProps> = ({
  activeTab,
  onTabChange,
  ano,
  onAnoChange,
  dateRange,
  onDateRangeChange,
  vendedor,
  onVendedorChange,
  vendedorOptions,
  cidade,
  onCidadeChange,
  cidadeOptions,
  activeCrossFilter,
  onClearCrossFilter,
  onResetFilters,
  hasActiveFilters,
  onRefresh,
  isRefreshing = false,
}) => {
  const isRed = activeTab === "perdas";

  return (
    <div className="sticky top-2 z-20 flex flex-col gap-3 p-3 md:p-3.5 rounded-2xl border border-[var(--voux-card-border)]/80 bg-[var(--voux-card-from)]/90 backdrop-blur-xl backdrop-saturate-150 shadow-md transition-all">
      {/* Linha Superior: Seletor de Abas + Anos Rápidos + Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Toggle de Abas sem emojis, minimalista e refinado */}
        <div className="inline-flex items-center p-1 rounded-xl bg-[var(--voux-surface)]/80 border border-[var(--voux-card-border)] self-start">
          <button
            onClick={() => onTabChange("ganhos")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all",
              activeTab === "ganhos"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-200" />
            <span>Vendas & Ganhos</span>
          </button>

          <button
            onClick={() => onTabChange("perdas")}
            className={cn(
              "flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all",
              activeTab === "perdas"
                ? "bg-red-600 text-white shadow-sm font-bold"
                : "text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            )}
          >
            <TrendingDown className="h-3.5 w-3.5 text-red-200" />
            <span>Diagnóstico de Perdas</span>
          </button>
        </div>

        {/* Seletor Rápido de Anos */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--voux-text-muted)] mr-1 font-mono">
            Ano:
          </span>

          {AVAILABLE_YEARS.map((y) => {
            const isSelected = ano === y;
            return (
              <button
                key={y}
                onClick={() => onAnoChange(isSelected ? null : y)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all",
                  isSelected
                    ? isRed
                      ? "bg-red-600 text-white shadow-sm"
                      : "bg-emerald-700 text-white dark:bg-emerald-600 shadow-sm"
                    : "bg-[var(--voux-card-border)]/40 text-[var(--voux-text-primary)] hover:bg-[var(--voux-card-border)]"
                )}
              >
                {y}
              </button>
            );
          })}

          <button
            onClick={() => onAnoChange(null)}
            className={cn(
              "px-2.5 py-1 rounded-lg text-xs font-mono font-medium transition-all",
              ano === null
                ? isRed
                  ? "bg-red-600 text-white shadow-sm"
                  : "bg-emerald-700 text-white dark:bg-emerald-600 shadow-sm"
                : "bg-[var(--voux-card-border)]/40 text-[var(--voux-text-primary)] hover:bg-[var(--voux-card-border)]"
            )}
          >
            Todos
          </button>

          {onRefresh && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRefresh}
              disabled={isRefreshing}
              className="h-7 w-7 p-0 ml-1 border-[var(--voux-card-border)] text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
              title="Atualizar dados"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
            </Button>
          )}
        </div>
      </div>

      {/* Linha Inferior: Filtro de Data + Vendedor + Cidade + Chip de Filtro Cruzado */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--voux-card-border)]/60">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />

        {/* Vendedor */}
        <Select
          value={vendedor || "__all__"}
          onValueChange={(v) => onVendedorChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--surface-raised)]/95 backdrop-blur-xl border-[var(--voux-card-border)] max-h-[300px]">
            <SelectItem value="__all__">Todos vendedores</SelectItem>
            {vendedorOptions.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Cidade / Filial */}
        <Select
          value={cidade || "__all__"}
          onValueChange={(v) => onCidadeChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-[160px] text-xs bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent className="bg-[var(--surface-raised)]/95 backdrop-blur-xl border-[var(--voux-card-border)] max-h-[300px]">
            <SelectItem value="__all__">Todas cidades</SelectItem>
            {cidadeOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Pílula Chic de Filtro Cruzado Ativo (Drill-Down Interativo) */}
        {activeCrossFilter && (
          <div
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-semibold border shadow-sm animate-in fade-in zoom-in-95",
              isRed
                ? "bg-red-500/15 border-red-500/40 text-red-700 dark:text-red-300"
                : "bg-emerald-500/15 border-emerald-500/40 text-emerald-800 dark:text-emerald-300"
            )}
          >
            <Filter className="h-3 w-3 shrink-0" />
            <span className="font-mono text-[11px] uppercase tracking-wider opacity-75">
              {activeCrossFilter.label}:
            </span>
            <span className="font-bold truncate max-w-[200px]" title={activeCrossFilter.value}>
              {activeCrossFilter.value}
            </span>
            <button
              onClick={onClearCrossFilter}
              className="ml-1 p-0.5 rounded-full hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
              title="Limpar este filtro cruzado"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Botão Limpar Todos os Filtros */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 px-2.5 text-xs text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)] ml-auto"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar Filtros
          </Button>
        )}
      </div>
    </div>
  );
};
