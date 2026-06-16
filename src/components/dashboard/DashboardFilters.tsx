import { Filters } from "@/types/comercial";
import { type DateRange } from "react-day-picker";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { hasActiveFilters } from "@/lib/filterUtils";
import { type CategoriaFilter, FUNIL_ALL, getFunilOptions } from "@/lib/categoriaFunil";

interface DashboardFiltersProps {
  filters: Filters;
  onFiltersChange: (filters: Filters) => void;
  cidades: string[];
  tiposAcao: string[];
  categorias: { value: CategoriaFilter; label: string }[];
}

export function DashboardFilters({
  filters,
  onFiltersChange,
  cidades,
  tiposAcao,
  categorias,
}: DashboardFiltersProps) {
  const dateRangeValue: DateRange | undefined = filters.dateRange
    ? {
        from: new Date(filters.dateRange.from + "T12:00:00"),
        to: new Date(filters.dateRange.to + "T12:00:00"),
      }
    : undefined;

  const handleDateChange = (range: DateRange | undefined) => {
    onFiltersChange({
      ...filters,
      dateRange: range?.from
        ? {
            from: range.from.toISOString().slice(0, 10),
            to: range.to?.toISOString().slice(0, 10) ?? range.from.toISOString().slice(0, 10),
          }
        : undefined,
    });
  };

  const updateFilter = (key: keyof Omit<Filters, "dateRange">, value: string) => {
    const newFilters = { ...filters, [key]: value === "__all__" ? "" : value };
    // When categoria changes, reset funil
    if (key === "categoria") {
      newFilters.funil = "";
    }
    onFiltersChange(newFilters);
  };

  const clearAll = () => {
    onFiltersChange({ cidade: "", tipoAcao: "", categoria: "", funil: "", dateRange: undefined });
  };

  const funilOptions = getFunilOptions((filters.categoria || "__all__") as CategoriaFilter);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <DateRangePicker value={dateRangeValue} onChange={handleDateChange} />

      <Select value={filters.categoria || "__all__"} onValueChange={(v) => updateFilter("categoria", v)}>
        <SelectTrigger className="h-7 w-[160px] text-[11px]" style={{ backgroundColor: "var(--voux-card-from)", borderColor: "var(--voux-card-border)", color: "var(--voux-text-primary)" }}>
          <SelectValue placeholder="Categoria" />
        </SelectTrigger>
        <SelectContent>
          {categorias.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.funil || FUNIL_ALL} onValueChange={(v) => updateFilter("funil", v)}>
        <SelectTrigger className="h-7 w-[160px] text-[11px]" style={{ backgroundColor: "var(--voux-card-from)", borderColor: "var(--voux-card-border)", color: "var(--voux-text-primary)" }}>
          <SelectValue placeholder="Funil" />
        </SelectTrigger>
        <SelectContent>
          {funilOptions.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.cidade || "__all__"} onValueChange={(v) => updateFilter("cidade", v)}>
        <SelectTrigger className="h-7 w-[120px] text-[11px]" style={{ backgroundColor: "var(--voux-card-from)", borderColor: "var(--voux-card-border)", color: "var(--voux-text-primary)" }}>
          <SelectValue placeholder="Cidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas cidades</SelectItem>
          {cidades.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filters.tipoAcao || "__all__"} onValueChange={(v) => updateFilter("tipoAcao", v)}>
        <SelectTrigger className="h-7 w-[120px] text-[11px]" style={{ backgroundColor: "var(--voux-card-from)", borderColor: "var(--voux-card-border)", color: "var(--voux-text-primary)" }}>
          <SelectValue placeholder="Tipo Acao" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos tipos</SelectItem>
          {tiposAcao.map((t) => (
            <SelectItem key={t} value={t}>{t}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilters(filters) && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground"
          onClick={clearAll}
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>
  );
}
