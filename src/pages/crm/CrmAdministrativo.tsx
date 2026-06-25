import { useMemo } from "react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { DashboardAdministrativo } from "@/components/dashboard/DashboardAdministrativo";
import { useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { DadosComerciais, Filters } from "@/types/comercial";

export default function CrmAdministrativo() {
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

  // Fetch all registros (no vendedor filter) — DashboardAdministrativo
  // filters admin users client-side via isAdminUser().
  const { data: registrosRpc, isLoading } = useRegistrosRecentes({
    from,
    to,
    enabled,
  });

  const data = useMemo<DadosComerciais>(() => {
    const registrosRecentes = (registrosRpc ?? []).map(mapRegistroRecente);
    return {
      kpis: { totalRegistros: registrosRecentes.length, totalClientes: 0, totalConsultores: 0, totalPipeline: 0, totalVisitas: 0, totalCidades: 0 },
      vendedores: [],
      regioes: [],
      evolucaoGlobal: [],
      tiposContato: {},
      tiposAcao: {},
      registrosRecentes,
      listaVendedores: [],
      listaCidades: [],
    };
  }, [registrosRpc]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    );
  }

  return <DashboardAdministrativo data={data} filters={filters} />;
}
