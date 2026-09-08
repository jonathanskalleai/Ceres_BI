import React, { useState } from "react";
import { Check, ChevronDown, Filter, Layers, RotateCcw } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { ALL_FUNIS } from "@/lib/categoriaFunil";

export interface FunilCategoryGroup {
  category: string;
  funis: string[];
}

export const FUNIL_GROUPS: FunilCategoryGroup[] = [
  {
    category: "Vendas Máquinas",
    funis: ["VENDAS", "ADM", "BANCOS", "OFICINA", "MARKETING"],
  },
  {
    category: "Vendas AP",
    funis: ["Vendas AP", "Adm AP", "Logistica AP"],
  },
  {
    category: "Repasse",
    funis: ["REPASSE DE MAQUINA"],
  },
];

interface DesempenhoFunilMultiSelectProps {
  selectedFunis: string[];
  onChange: (funis: string[]) => void;
  className?: string;
}

export const DesempenhoFunilMultiSelect: React.FC<DesempenhoFunilMultiSelectProps> = ({
  selectedFunis,
  onChange,
  className,
}) => {
  const [open, setOpen] = useState(false);

  const isAllSelected =
    selectedFunis.length === ALL_FUNIS.length &&
    ALL_FUNIS.every((f) => selectedFunis.includes(f));

  const handleToggle = (funil: string) => {
    if (selectedFunis.includes(funil)) {
      onChange(selectedFunis.filter((f) => f !== funil));
    } else {
      onChange([...selectedFunis, funil]);
    }
  };

  const handleSelectAll = () => {
    onChange([...ALL_FUNIS]);
  };

  const handleClear = () => {
    onChange([]);
  };

  const handleToggleGroup = (group: FunilCategoryGroup) => {
    const allInGroupSelected = group.funis.every((f) => selectedFunis.includes(f));
    if (allInGroupSelected) {
      // Remove todos do grupo
      onChange(selectedFunis.filter((f) => !group.funis.includes(f)));
    } else {
      // Adiciona os que faltam do grupo
      const newSelected = new Set([...selectedFunis, ...group.funis]);
      onChange(Array.from(newSelected));
    }
  };

  // Label do botão trigger
  const triggerLabel = () => {
    if (selectedFunis.length === 0) {
      return "Todos os funis";
    }
    if (isAllSelected) {
      return `Todos os funis (${ALL_FUNIS.length})`;
    }
    if (selectedFunis.length === 1) {
      return selectedFunis[0];
    }
    return `${selectedFunis.length} funis selecionados`;
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-expanded={open}
          className={cn(
            "h-8 px-2.5 inline-flex items-center justify-between gap-1.5 rounded-md border text-xs transition-colors",
            "bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)] hover:border-[var(--voux-champagne-400)]/60",
            selectedFunis.length > 0 &&
              "border-emerald-600/60 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 font-semibold",
            className
          )}
        >
          <div className="flex items-center gap-1.5 truncate">
            <Layers className="h-3.5 w-3.5 shrink-0 opacity-70" />
            <span className="truncate">{triggerLabel()}</span>
          </div>

          {selectedFunis.length > 1 && !isAllSelected && (
            <Badge
              variant="secondary"
              className="h-4 px-1 text-[10px] font-mono bg-emerald-600/20 text-emerald-700 dark:text-emerald-300 border-none ml-1"
            >
              {selectedFunis.length}
            </Badge>
          )}

          <ChevronDown className="h-3 w-3 shrink-0 opacity-50 ml-1" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[280px] p-0 bg-[var(--surface-raised)]/95 backdrop-blur-xl border border-[var(--voux-card-border)] shadow-xl rounded-xl overflow-hidden z-50"
      >
        {/* Header com ações rápidas */}
        <div className="p-3 border-b border-[var(--voux-card-border)]/60 bg-[var(--voux-surface)]/50">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-[var(--voux-text-primary)] flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-primary" />
              Filtrar por Funil
            </span>
            {selectedFunis.length > 0 && (
              <span className="text-[10px] font-mono text-[var(--voux-text-muted)]">
                {selectedFunis.length} de {ALL_FUNIS.length}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSelectAll}
              className="h-6 px-2 text-[11px] border-[var(--voux-card-border)] hover:bg-[var(--voux-card-from)] text-[var(--voux-text-soft)]"
            >
              Marcar todos
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleClear}
              className="h-6 px-2 text-[11px] text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)] ml-auto"
            >
              <RotateCcw className="h-3 w-3 mr-1" />
              Padrão
            </Button>
          </div>
        </div>

        {/* Lista de Grupos de Funis com Checkbox */}
        <div className="max-h-[320px] overflow-y-auto p-2 space-y-3 divide-y divide-[var(--voux-card-border)]/40">
          {FUNIL_GROUPS.map((group, groupIdx) => {
            const allInGroup = group.funis.every((f) => selectedFunis.includes(f));
            const someInGroup = group.funis.some((f) => selectedFunis.includes(f));

            return (
              <div key={group.category} className={cn("space-y-1", groupIdx > 0 && "pt-2")}>
                <div
                  onClick={() => handleToggleGroup(group)}
                  className="flex items-center justify-between px-2 py-1 rounded cursor-pointer hover:bg-foreground/[0.04] transition-colors group"
                >
                  <span className="text-[10px] font-bold tracking-wider uppercase font-mono text-[var(--voux-text-muted)] group-hover:text-[var(--voux-text-primary)]">
                    {group.category}
                  </span>
                  <span className="text-[10px] text-[var(--voux-text-muted)] font-mono">
                    {group.funis.filter((f) => selectedFunis.includes(f)).length}/{group.funis.length}
                  </span>
                </div>

                <div className="space-y-0.5">
                  {group.funis.map((funil) => {
                    const checked = selectedFunis.includes(funil);
                    return (
                      <label
                        key={funil}
                        className={cn(
                          "flex items-center gap-2 px-2 py-1.5 rounded-lg cursor-pointer text-xs transition-colors",
                          checked
                            ? "bg-emerald-500/10 text-foreground font-medium"
                            : "text-[var(--voux-text-soft)] hover:bg-foreground/[0.03] hover:text-[var(--voux-text-primary)]"
                        )}
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => handleToggle(funil)}
                          className={cn(
                            "h-3.5 w-3.5 rounded border-[var(--voux-card-border)]",
                            checked && "bg-emerald-600 border-emerald-600 text-white"
                          )}
                        />
                        <span className="truncate">{funil}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="p-2 border-t border-[var(--voux-card-border)]/60 bg-[var(--voux-surface)]/30 text-center">
          <p className="text-[10px] text-[var(--voux-text-muted)]">
            {selectedFunis.length === 0
              ? "Sem seleção = visualização padrão consolidada"
              : `Filtrando por ${selectedFunis.length} funil(is)`}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
};
