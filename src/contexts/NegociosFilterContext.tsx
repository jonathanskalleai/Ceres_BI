import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import {
  type CategoriaFilter,
  CATEGORIA_ALL,
  FUNIL_ALL,
} from "@/lib/categoriaFunil";

interface NegociosFilterState {
  dateRange: DateRange | undefined;
  categoria: CategoriaFilter;
  funil: string;
  vendedor: string;
  cidade: string;
}

interface NegociosFilterContextValue extends NegociosFilterState {
  setDateRange: (range: DateRange | undefined) => void;
  setCategoria: (cat: CategoriaFilter) => void;
  setFunil: (funil: string) => void;
  setVendedor: (vendedor: string) => void;
  setCidade: (cidade: string) => void;
  resetFilters: () => void;
  hasActiveFilter: boolean;
}

const NegociosFilterContext = createContext<NegociosFilterContextValue | null>(null);

export function NegociosFilterProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [categoria, setCategoria_] = useState<CategoriaFilter>(CATEGORIA_ALL);
  const [funil, setFunil] = useState<string>(FUNIL_ALL);
  const [vendedor, setVendedor] = useState<string>("");
  const [cidade, setCidade] = useState<string>("");

  const setCategoria = useCallback((cat: CategoriaFilter) => {
    setCategoria_(cat);
    // Reset funil when categoria changes (funis depend on categoria)
    setFunil(FUNIL_ALL);
  }, []);

  const resetFilters = useCallback(() => {
    setDateRange(undefined);
    setCategoria_(CATEGORIA_ALL);
    setFunil(FUNIL_ALL);
    setVendedor("");
    setCidade("");
  }, []);

  const hasActiveFilter =
    dateRange !== undefined ||
    categoria !== CATEGORIA_ALL ||
    funil !== FUNIL_ALL ||
    vendedor !== "" ||
    cidade !== "";

  return (
    <NegociosFilterContext.Provider
      value={{
        dateRange,
        categoria,
        funil,
        vendedor,
        cidade,
        setDateRange,
        setCategoria,
        setFunil,
        setVendedor,
        setCidade,
        resetFilters,
        hasActiveFilter,
      }}
    >
      {children}
    </NegociosFilterContext.Provider>
  );
}

export function useNegociosFilter(): NegociosFilterContextValue {
  const ctx = useContext(NegociosFilterContext);
  if (!ctx) {
    throw new Error("useNegociosFilter must be used within NegociosFilterProvider");
  }
  return ctx;
}
