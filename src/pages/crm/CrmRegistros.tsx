import { useMemo } from "react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { DashboardRegistros } from "@/components/dashboard/DashboardRegistros";
import { useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { Filters } from "@/types/comercial";

export default function CrmRegistros() {
  const { dateRange, cidade, tipoAcao } = useNegociosFilter();

  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to;

  const filters: Filters = {
    cidade,
    tipoAcao,
    categoria: "",
    funil: "",
    dateRange: from && to ? { from, to } : undefined,
  };

  const { data: registrosRpc, isLoading } = useRegistrosRecentes({
    from,
    to,
    cidade: cidade || undefined,
    enabled,
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

  return <DashboardRegistros registros={registros} filters={filters} />;
}
