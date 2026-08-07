import { useMemo } from "react";
import { DashboardInsights } from "@/components/dashboard/DashboardInsights";
import { useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { Filters } from "@/types/comercial";
import { Skeleton } from "@/components/ui/skeleton";

export default function CrmInsights() {
  const { dateRange, cidade, tipoAcao } = useNegociosFilter();

  const from = toISODate(dateRange?.from) ?? "";
  const to   = toISODate(dateRange?.to)   ?? "";
  const enabled = !!from && !!to;

  const { data: rpcRegistros, isLoading } = useRegistrosRecentes({ from, to, cidade: cidade || undefined, enabled });

  const registros = useMemo(
    () => (rpcRegistros ?? []).map(mapRegistroRecente),
    [rpcRegistros],
  );

  // Filters for DashboardInsights (date already applied by RPC; pass remaining)
  const filters: Filters = {
    cidade: "",          // already filtered server-side
    tipoAcao: tipoAcao,
    categoria: "",
    funil: "",
    dateRange: undefined, // already filtered server-side
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return <DashboardInsights registros={registros} filters={filters} />;
}
