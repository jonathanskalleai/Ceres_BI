import React from "react";
import { X, Calendar } from "lucide-react";
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

interface DesempenhoFilterBarProps {
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
}

const AVAILABLE_YEARS = [2026, 2025, 2024];

export const DesempenhoFilterBar: React.FC<DesempenhoFilterBarProps> = ({
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
}) => {
  return (
    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-4 rounded-2xl border border-[var(--voux-card-border)]/80 bg-[var(--surface-raised)]/85 dark:bg-[var(--surface-raised)]/75 backdrop-blur-xl shadow-[0_4px_20px_-4px_rgba(0,0,0,0.04)]">
      {/* Lado Esquerdo: Seletor Rápido de Anos (Visão Anual) */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1 text-xs font-semibold text-[var(--voux-text-muted)] mr-1">
          <Calendar className="h-3.5 w-3.5" />
          <span>Visão Anual:</span>
        </div>

        {AVAILABLE_YEARS.map((y) => {
          const isSelected = ano === y;
          return (
            <button
              key={y}
              onClick={() => onAnoChange(isSelected ? null : y)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all",
                isSelected
                  ? "bg-emerald-700 text-white dark:bg-emerald-600 shadow-sm"
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
            "px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all",
            ano === null
              ? "bg-emerald-700 text-white dark:bg-emerald-600 shadow-sm"
              : "bg-[var(--voux-card-border)]/40 text-[var(--voux-text-primary)] hover:bg-[var(--voux-card-border)]"
          )}
        >
          Todo o Período
        </button>
      </div>

      {/* Lado Direito: Filtros Específicos (Período Personalizado, Vendedor, Cidade, Condição) */}
      <div className="flex items-center gap-2 flex-wrap">
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
            className="h-8 px-2.5 text-xs text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
          >
            <X className="h-3.5 w-3.5 mr-1" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
};
