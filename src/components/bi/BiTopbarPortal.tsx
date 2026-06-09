import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import {
  type CategoriaFilter,
  CATEGORIA_OPTIONS,
  getFunilOptions,
} from "@/lib/categoriaFunil";

/**
 * Renders BI filters inside the AppShell topbar via React Portal.
 * Target: <div id="topbar-actions"> in AppShellTopbar.
 */
export function BiTopbarPortal() {
  const {
    dateRange,
    setDateRange,
    categoria,
    setCategoria,
    funil,
    setFunil,
    resetFilters,
    hasActiveFilter,
  } = useNegociosFilter();

  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("topbar-actions");
    setContainer(el);
  }, []);

  const funilOptions = getFunilOptions(categoria);

  if (!container) return null;

  return createPortal(
    <div className="flex items-center gap-2 flex-wrap">
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      <Select
        value={categoria}
        onValueChange={(v) => setCategoria(v as CategoriaFilter)}
      >
        <SelectTrigger className="h-7 w-[160px] text-[11px] bg-[#1a1916] border-[rgba(214,207,193,0.12)] text-[#e8e2d9]">
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          {CATEGORIA_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={funil} onValueChange={setFunil}>
        <SelectTrigger className="h-7 w-[160px] text-[11px] bg-[#1a1916] border-[rgba(214,207,193,0.12)] text-[#e8e2d9]">
          <SelectValue placeholder="Funil" />
        </SelectTrigger>
        <SelectContent>
          {funilOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-7 px-2 text-[11px] text-[#b3ab9c] hover:text-[#e8e2d9]"
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>,
    container
  );
}
