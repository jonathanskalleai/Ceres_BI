import { useMemo } from "react";
import { DashboardMapa } from "@/components/dashboard/DashboardMapa";
import { useRankingRegioes } from "@/hooks/useComercialRpc";
import { useComercialDataContext } from "@/contexts/ComercialDataContext";
import type { DadosComerciais, RegiaoSummary } from "@/types/comercial";
import type { RpcRankingRegiao } from "@/types/comercialRpc";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * CrmMapaRpc — RPC-backed version of the map page.
 * Uses rpc_ranking_regioes for the "regioes" view.
 * The "clientes" view requires registrosRecentes which has no RPC yet — renders empty.
 * TODO: Create rpc_registros_recentes for client-point map view.
 */
export default function CrmMapaRpc() {
  const { filters } = useComercialDataContext();
  const from = filters.dateRange?.from ?? "";
  const to = filters.dateRange?.to ?? "";

  const { data: regioesRpc, isLoading } = useRankingRegioes({
    from,
    to,
    enabled: !!from && !!to,
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

    return {
      kpis: {
        totalRegistros: 0,
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
      registrosRecentes: [], // No RPC yet — clientes view shows empty
      listaVendedores: [],
      listaCidades: regioes.map((r) => r.cidade),
    };
  }, [regioesRpc]);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  return <DashboardMapa data={fakeData} filters={filters} />;
}
