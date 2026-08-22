import React from "react";
import { X, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
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
  condicao: string;
  onCondicaoChange: (condicao: string) => void;
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
  condicao,
  onCondicaoChange,
  onResetFilters,
  hasActiveFilters,
  onRefresh,
  isRefreshing = false,
}) => {
  return (
    <div className="flex flex-col gap-3 p-3 md:p-3.5 rounded-2xl border border-[var(--voux-card-border)] bg-[var(--voux-card-from)] shadow-sm">
      {/* Linha Superior: Seletor de Abas + Anos Rápidos + Refresh */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Toggle de Abas sem emojis, minimalista e refinado */}
        <div className="inline-flex items-center p-1 rounded-xl bg-[var(--voux-surface)] border border-[var(--voux-card-border)] self-start">
          <button
            onClick={() => onTabChange("ganhos")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all",
              activeTab === "ganhos"
                ? "bg-emerald-600 text-white shadow-sm font-bold"
                : "text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            )}
          >
            <TrendingUp className="h-3.5 w-3.5 text-emerald-300" />
            <span>Vendas & Ganhos</span>
          </button>

          <button
            onClick={() => onTabChange("perdas")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all",
              activeTab === "perdas"
                ? "bg-red-600 text-white shadow-sm font-bold"
                : "text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
            )}
          >
            <TrendingDown className="h-3.5 w-3.5 text-red-300" />
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
                    ? activeTab === "perdas"
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
                ? activeTab === "perdas"
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

      {/* Linha Inferior: Filtros Detalhados */}
      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-[var(--voux-card-border)]/60">
        <DateRangePicker value={dateRange} onChange={onDateRangeChange} />

        {/* Vendedor */}
        <Select
          value={vendedor || "__all__"}
          onValueChange={(v) => onVendedorChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-[150px] text-xs bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
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
          <SelectTrigger className="h-8 w-[150px] text-xs bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
            <SelectValue placeholder="Cidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Todas cidades</SelectItem>
            {cidadeOptions.map((c) => (
              <SelectItem key={c} value={c}>
                {c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Condição: Novo / Usado */}
        <Select
          value={condicao || "__all__"}
          onValueChange={(v) => onCondicaoChange(v === "__all__" ? "" : v)}
        >
          <SelectTrigger className="h-8 w-[130px] text-xs bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
            <SelectValue placeholder="Condição" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="__all__">Novos e Usados</SelectItem>
            <SelectItem value="Novo">Apenas Novos</SelectItem>
            <SelectItem value="Usado">Apenas Usados</SelectItem>
          </SelectContent>
        </Select>

        {/* Botão Limpar */}
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetFilters}
            className="h-8 px-2.5 text-xs text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)] ml-auto"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
};
