import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardConsultores } from "@/components/dashboard/DashboardConsultores";
import { useRankingVendedoresV2, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useComercialDataContext } from "@/contexts/ComercialDataContext";
import { Skeleton } from "@/components/ui/skeleton";
import type { DadosComerciais, Vendedor, Registro } from "@/types/comercial";
import type { RpcRankingVendedorV2, RpcRegistroRecente } from "@/types/comercialRpc";

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

/** Maps a RpcRegistroRecente row to the Registro domain shape. */
function mapRegistro(r: RpcRegistroRecente): Registro {
  return {
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
    vendedor: filters.cidade ? undefined : undefined, // no vendedor filter at page level
    cidade: filters.cidade || undefined,
    enabled,
  });

  const data = useMemo<DadosComerciais>(() => {
    const vendedores: Vendedor[] = (rankingRpc ?? []).map(mapVendedor);
    const registrosRecentes: Registro[] = (registrosRpc ?? []).map(mapRegistro);

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
