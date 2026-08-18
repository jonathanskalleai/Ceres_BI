import { useState, useMemo, useEffect, useRef } from "react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { DashboardRegistros } from "@/components/dashboard/DashboardRegistros";
import { useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { Filters } from "@/types/comercial";

/**
 * Tela Atividades — /crm/registros
 * 
 * Carregamento inteligente:
 * - Sem busca: mostra ações do mês/período selecionado (filtros do toolbar)
 * - Com busca por cliente (3+ chars): expande para o ano inteiro (jan→hoje)
 * - Debounce de 400ms na busca para não disparar queries a cada tecla
 */
export default function CrmRegistros() {
  const { dateRange, cidade, vendedor, tipoAcao } = useNegociosFilter();
  const [clientSearch, setClientSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounce: espera 400ms após parar de digitar
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(clientSearch);
    }, 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [clientSearch]);

  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to;

  // Quando há busca por cliente, expandir para o ano inteiro
  const isSearching = debouncedSearch.length >= 3;
  const yearStart = `${new Date().getFullYear()}-01-01`;
  const today = toISODate(new Date()) ?? "";

  const queryFrom = isSearching ? yearStart : from;
  const queryTo = isSearching ? today : to;

  const filters: Filters = {
    cidade,
    tipoAcao,
    categoria: "",
    funil: "",
    dateRange: from && to ? { from, to } : undefined,
  };

  // Buscar ações do período (ou ano inteiro quando buscando)
  const { data: registrosRpc, isLoading } = useRegistrosRecentes({
    from: queryFrom,
    to: queryTo,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    limit: 5000,
    enabled: enabled || isSearching,
  });

  const registros = useMemo(
    () => (registrosRpc ?? []).map(mapRegistroRecente),
    [registrosRpc],
  );

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96" />
      </div>
    );
  }

  return (
    <DashboardRegistros
      registros={registros}
      filters={filters}
      clientSearch={clientSearch}
      onClientSearchChange={setClientSearch}
      isSearchingYear={isSearching}
    />
  );
}
