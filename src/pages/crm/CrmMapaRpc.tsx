import { useMemo } from "react";
import { DashboardMapa } from "@/components/dashboard/DashboardMapa";
import { useRankingRegioes, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { DadosComerciais, Filters, RegiaoSummary } from "@/types/comercial";
import type { RpcRankingRegiao } from "@/types/comercialRpc";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * CrmMapaRpc — RPC-backed version of the map page.
 * Uses rpc_ranking_regioes for the "regioes" view.
 * Uses rpc_registros_recentes for the "clientes" view (individual action points).
 */
export default function CrmMapaRpc() {
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

  const { data: regioesRpc, isLoading: loadingRegioes } = useRankingRegioes({
    from,
    to,
    enabled,
  });

  const { data: registrosRpc, isLoading: loadingRegistros } = useRegistrosRecentes({
    from,
    to,
    enabled,
  });

  const fakeData = useMemo<DadosComerciais>(() => {
    const regioes: RegiaoSummary[] = (regioesRpc ?? []).map((r: RpcRankingRegiao) => ({
      cidade: r.cidade,
      totalAcoes: r.acoes,
      clientes: r.clientes,
      pipeline: r.valor,
      visitas: r.visitas,
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
    }));

    const registrosRecentes = (registrosRpc ?? []).map(mapRegistroRecente);

    return {
      kpis: {
        totalRegistros: registrosRecentes.length,
        totalClientes: 0,
        totalConsultores: 0,
        totalPipeline: 0,
        totalVisitas: 0,
        totalCidades: regioes.length,
      },
      vendedores: [],
      regioes,
      evolucaoGlobal: [],
      tiposContato: {},
      tiposAcao: {},
      registrosRecentes,
      listaVendedores: [],
      listaCidades: regioes.map((r) => r.cidade),
    };
  }, [regioesRpc, registrosRpc]);

  if (loadingRegioes || loadingRegistros) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  return <DashboardMapa data={fakeData} filters={filters} />;
}
