import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardConsultores } from "@/components/dashboard/DashboardConsultores";
import { useRankingVendedoresV2, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import type { Filters, Vendedor } from "@/types/comercial";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
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
 */
export default function CrmConsultoresRpc() {
  const { dateRange, cidade } = useNegociosFilter();
  const navigate = useNavigate();

  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to;

  const filters: Filters = {
    cidade: cidade,
    tipoAcao: "",
    categoria: "",
    funil: "",
    dateRange: from && to ? { from, to } : undefined,
  };

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
    cidade: cidade || undefined,
    enabled,
  });

  const vendedores = useMemo<Vendedor[]>(
    () => (rankingRpc ?? []).map(mapVendedor),
    [rankingRpc],
  );

  const registros = useMemo(
    () => (registrosRpc ?? []).map(mapRegistroRecente),
    [registrosRpc],
  );

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
      vendedores={vendedores}
      registros={registros}
      filters={filters}
      onSelectConsultor={(nome) => navigate(`/crm/consultores/${encodeURIComponent(nome)}`)}
    />
  );
}
