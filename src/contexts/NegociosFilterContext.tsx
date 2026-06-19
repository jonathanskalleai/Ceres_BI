import { createContext, useContext, useState, useCallback, type ReactNode } from "react";
import { type DateRange } from "react-day-picker";
import { startOfMonth, endOfMonth } from "date-fns";

function currentMonthRange(): DateRange {
  const now = new Date();
  return { from: startOfMonth(now), to: endOfMonth(now) };
}
import {
  type CategoriaFilter,
  CATEGORIA_ALL,
  FUNIL_ALL,
} from "@/lib/categoriaFunil";

interface NegociiosFilterState {
  dateRange: DateRange | undefined;
  categoria: CategoriaFilter;
  funil: string;
  vendedor: string;
  cidade: string;
  tipoAcao: string;
}

interface NegociiosFilterContextValue extends NegociiosFilterState {
  setDateRange: (range: DateRange | undefined) => void;
  setCategoria: (cat: CategoriaFilter) => void;
  setFunil: (funil: string) => void;
  setVendedor: (vendedor: string) => void;
  setCidade: (cidade: string) => void;
  setTipoAcao: (tipo: string) => void;
  resetFilters: () => void;
  hasActiveFilter: boolean;
}

const NegociiosFilterContext = createContext<NegociiosFilterContextValue | null>(null);

export function NegociiosFilterProvider({ children }: { children: ReactNode }) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(() => currentMonthRange());
  const [categoria, setCategoria_] = useState<CategoriaFilter>(CATEGORIA_ALL);
  const [funil, setFunil] = useState<string>(FUNIL_ALL);
  const [vendedor, setVendedor] = useState<string>("");
  const [cidade, setCidade] = useState<string>("");
  const [tipoAcao, setTipoAcao] = useState<string>("");

  const setCategoria = useCallback((cat: CategoriaFilter) => {
    setCategoria_(cat);
    // Reset funil when categoria changes (funis depend on categoria)
    setFunil(FUNIL_ALL);
  }, []);

  const resetFilters = useCallback(() => {
    setDateRange(currentMonthRange());
    setCategoria_(CATEGORIA_ALL);
    setFunil(FUNIL_ALL);
    setVendedor("");
    setCidade("");
    setTipoAcao("");
  }, []);

  const hasActiveFilter =
    dateRange !== undefined ||
    categoria !== CATEGORIA_ALL ||
    funil !== FUNIL_ALL ||
    vendedor !== "" ||
    cidade !== "" ||
    tipoAcao !== "";

  return (
    <NegociiosFilterContext.Provider
      value={{
        dateRange,
        categoria,
        funil,
        vendedor,
        cidade,
        tipoAcao,
        setDateRange,
        setCategoria,
        setFunil,
        setVendedor,
        setCidade,
        setTipoAcao,
        resetFilters,
        hasActiveFilter,
      }}
    >
      {children}
    </NegociiosFilterContext.Provider>
  );
}

export function useNegociosFilter(): NegociiosFilterContextValue {
  const ctx = useContext(NegociiosFilterContext);
  if (!ctx) {
    throw new Error("useNegociosFilter must be used within NegociiosFilterProvider");
  }
  return ctx;
}
