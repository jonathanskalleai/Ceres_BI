import { useMemo } from "react";
import { DashboardMapa } from "@/components/dashboard/DashboardMapa";
import { useRankingRegioes, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useComercialDataContext } from "@/contexts/ComercialDataContext";
import type { DadosComerciais, RegiaoSummary, Registro } from "@/types/comercial";
import type { RpcRankingRegiao, RpcRegistroRecente } from "@/types/comercialRpc";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * CrmMapaRpc — RPC-backed version of the map page.
 * Uses rpc_ranking_regioes for the "regioes" view.
 * Uses rpc_registros_recentes for the "clientes" view (individual action points).
 */
export default function CrmMapaRpc() {
  const { filters } = useComercialDataContext();
  const from = filters.dateRange?.from ?? "";
  const to = filters.dateRange?.to ?? "";
  const enabled = !!from && !!to;

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

    const registrosRecentes: Registro[] = (registrosRpc ?? []).map((r: RpcRegistroRecente) => ({
      cliente: r.cliente ?? "",
      cidade: r.cidade ?? "",
      vendedor: r.vendedor ?? "",
      tipoContato: r.tipo_contato ?? "",
      tipoAcao: r.tipo_acao ?? "",
      negocioValor: r.negocio_valor ?? 0,
      negocioEtapa: r.negocio_etapa ?? "",
      dtConclusao: r.dt_conclusao ?? "",
      obs: r.obs ?? "",
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
      status: r.status ?? undefined,
      nroNegocio: r.nro_negocio ?? undefined,
    }));

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
