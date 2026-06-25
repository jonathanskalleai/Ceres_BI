import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardConsultores } from "@/components/dashboard/DashboardConsultores";
import { useRankingVendedoresV2, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useComercialDataContext } from "@/contexts/ComercialDataContext";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { DadosComerciais, Vendedor } from "@/types/comercial";
import type { RpcRankingVendedorV2 } from "@/types/comercialRpc";

/**
 * Maps a RpcRankingVendedorV2 row to the Vendedor domain shape.
 * Fields not provided by the RPC (evolucao, topClientes, regioes, tiposAcao)
 * are left as empty arrays/objects — DashboardConsultores only reads the scalar fields.
 */
function mapVendedor(r: RpcRankingVendedorV2): Vendedor {
  return {
    nome: r.vendedor,
    totalAcoes: Number(r.acoes),
    visitas: Number(r.visitas),
    clientes: Number(r.clientes),
    pipeline: Number(r.pipeline),
    negocios: Number(r.negocios),
    conversao: r.conversao,
    crmQuality: r.crm_quality,
    evolucao: [],
    topClientes: [],
    regioes: [],
    tiposAcao: {},
  };
}


/**
 * CrmConsultoresRpc — RPC-backed consultores page.
 * Replaces browser-side aggregation from ComercialDataContext.
 */
export default function CrmConsultoresRpc() {
  const { filters } = useComercialDataContext();
  const navigate = useNavigate();

  const from = filters.dateRange?.from ?? "";
  const to = filters.dateRange?.to ?? "";
  const enabled = !!from && !!to;

  const { data: rankingRpc, isLoading: loadingRanking } = useRankingVendedoresV2({
    from,
    to,
    enabled,
  });

  // Fetch registros only when city or vendedor filter is active
  // (the component uses them for filtered re-aggregation)
  const { data: registrosRpc, isLoading: loadingRegistros } = useRegistrosRecentes({
    from,
    to,
    cidade: filters.cidade || undefined,
    enabled,
  });

  const data = useMemo<DadosComerciais>(() => {
    const vendedores: Vendedor[] = (rankingRpc ?? []).map(mapVendedor);
    const registrosRecentes = (registrosRpc ?? []).map(mapRegistroRecente);

    const listaCidades = Array.from(
      new Set(registrosRecentes.map((r) => r.cidade).filter(Boolean))
    );

    return {
      kpis: {
        totalRegistros: registrosRecentes.length,
        totalClientes: vendedores.reduce((s, v) => s + v.clientes, 0),
        totalConsultores: vendedores.length,
        totalPipeline: vendedores.reduce((s, v) => s + v.pipeline, 0),
        totalVisitas: vendedores.reduce((s, v) => s + v.visitas, 0),
        totalCidades: listaCidades.length,
      },
      vendedores,
      regioes: [],
      evolucaoGlobal: [],
      tiposContato: {},
      tiposAcao: {},
      registrosRecentes,
      listaVendedores: vendedores.map((v) => v.nome),
      listaCidades,
    };
  }, [rankingRpc, registrosRpc]);

  if (loadingRanking || loadingRegistros) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return (
    <DashboardConsultores
      data={data}
      filters={filters}
      onSelectConsultor={(nome) => navigate(`/crm/consultores/${encodeURIComponent(nome)}`)}
    />
  );
}
