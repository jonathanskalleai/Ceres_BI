import { useMemo } from "react";
import { DashboardMapa } from "@/components/dashboard/DashboardMapa";
import { useRankingRegioes, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { Filters, RegiaoSummary } from "@/types/comercial";
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

  const regioes = useMemo<RegiaoSummary[]>(
    () => (regioesRpc ?? []).map((r: RpcRankingRegiao) => ({
      cidade: r.cidade,
      totalAcoes: r.acoes,
      clientes: r.clientes,
      pipeline: r.valor,
      visitas: r.visitas,
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
    })),
    [regioesRpc],
  );

  const registros = useMemo(
    () => (registrosRpc ?? []).map(mapRegistroRecente),
    [registrosRpc],
  );

  if (loadingRegioes || loadingRegistros) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-[520px]" />
      </div>
    );
  }

  return <DashboardMapa regioes={regioes} registros={registros} filters={filters} />;
}
