import { createPortal } from "react-dom";
import { useEffect, useState, useMemo } from "react";
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
import { useComercialData } from "@/hooks/useComercialData";

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
    vendedor,
    setVendedor,
    cidade,
    setCidade,
    resetFilters,
    hasActiveFilter,
  } = useNegociosFilter();

  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const el = document.getElementById("topbar-actions");
    setContainer(el);
  }, []);

  const funilOptions = getFunilOptions(categoria);

  // Derive vendedor/cidade options from data
  const { allData } = useComercialData(categoria, funil);
  const vendedorOptions = useMemo(() => {
    if (!allData) return [];
    return allData.listaVendedores;
  }, [allData]);

  const cidadeOptions = useMemo(() => {
    if (!allData) return [];
    return allData.listaCidades;
  }, [allData]);

  if (!container) return null;

  return createPortal(
    <div className="flex items-center gap-2 flex-wrap">
      <DateRangePicker value={dateRange} onChange={setDateRange} />

      <Select
        value={categoria}
        onValueChange={(v) => setCategoria(v as CategoriaFilter)}
      >
        <SelectTrigger className="h-7 w-[160px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
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
        <SelectTrigger className="h-7 w-[160px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
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

      <Select value={vendedor || "__all__"} onValueChange={(v) => setVendedor(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-7 w-[150px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
          <SelectValue placeholder="Vendedor" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todos vendedores</SelectItem>
          {vendedorOptions.map((v) => (
            <SelectItem key={v} value={v}>{v}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={cidade || "__all__"} onValueChange={(v) => setCidade(v === "__all__" ? "" : v)}>
        <SelectTrigger className="h-7 w-[150px] text-[11px] bg-[var(--voux-card-from)] border-[var(--voux-card-border)] text-[var(--voux-text-primary)]">
          <SelectValue placeholder="Cidade" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__all__">Todas cidades</SelectItem>
          {cidadeOptions.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {hasActiveFilter && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="h-7 px-2 text-[11px] text-[var(--voux-text-muted)] hover:text-[var(--voux-text-primary)]"
        >
          <X className="h-3 w-3 mr-1" />
          Limpar
        </Button>
      )}
    </div>,
    container
  );
}
