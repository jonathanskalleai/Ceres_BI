import { useMemo } from "react";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { DashboardClientesCriticos } from "@/components/dashboard/DashboardClientesCriticos";
import { useRankingVendedoresV2, useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { DadosComerciais, Filters, Vendedor, TopCliente } from "@/types/comercial";
import type { RpcRankingVendedorV2 } from "@/types/comercialRpc";

/**
 * Builds topClientes per vendedor from flat registros.
 * Computes diasSemContato = days since last contact per client.
 */
function buildTopClientes(
  registros: { cliente: string; cidade: string; vendedor: string; tipoContato: string; negocioValor: number; dtConclusao: string }[]
): Map<string, TopCliente[]> {
  const now = Date.now();
  const vMap = new Map<string, Map<string, { acoes: number; visitas: number; negocioValor: number; diasSemContato: number; cidade: string }>>();

  for (const r of registros) {
    if (!r.vendedor || !r.cliente) continue;
    if (!vMap.has(r.vendedor)) vMap.set(r.vendedor, new Map());
    const clienteMap = vMap.get(r.vendedor)!;
    if (!clienteMap.has(r.cliente)) {
      clienteMap.set(r.cliente, { acoes: 0, visitas: 0, negocioValor: 0, diasSemContato: 999, cidade: r.cidade });
    }
    const c = clienteMap.get(r.cliente)!;
    c.acoes++;
    if (r.tipoContato?.toLowerCase().includes("visita")) c.visitas++;
    c.negocioValor += r.negocioValor;
    if (r.dtConclusao) {
      const days = Math.floor((now - new Date(r.dtConclusao).getTime()) / 86400000);
      if (days >= 0 && days < c.diasSemContato) c.diasSemContato = days;
    }
  }

  const result = new Map<string, TopCliente[]>();
  for (const [vendedor, clienteMap] of vMap) {
    result.set(
      vendedor,
      Array.from(clienteMap.entries()).map(([nome, c]) => ({
        nome,
        cidade: c.cidade,
        acoes: c.acoes,
        visitas: c.visitas,
        negocioValor: c.negocioValor,
        diasSemContato: c.diasSemContato,
      }))
    );
  }
  return result;
}

function mapVendedorWithClientes(r: RpcRankingVendedorV2, topClientes: TopCliente[]): Vendedor {
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
    topClientes,
    regioes: [],
    tiposAcao: {},
  };
}

export default function CrmCriticos() {
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

  const { data: rankingRpc, isLoading: loadingRanking } = useRankingVendedoresV2({
    from,
    to,
    enabled,
  });

  // Fetch ALL registros (no city filter) — needed to compute diasSemContato accurately
  const { data: registrosRpc, isLoading: loadingRegistros } = useRegistrosRecentes({
    from,
    to,
    enabled,
  });

  const rpcData = useMemo<DadosComerciais>(() => {
    const registrosRecentes = (registrosRpc ?? []).map(mapRegistroRecente);
    const topClientesMap = buildTopClientes(registrosRecentes);

    const vendedores: Vendedor[] = (rankingRpc ?? []).map((r) =>
      mapVendedorWithClientes(r, topClientesMap.get(r.vendedor) ?? [])
    );

    return {
      kpis: { totalRegistros: registrosRecentes.length, totalClientes: 0, totalConsultores: vendedores.length, totalPipeline: 0, totalVisitas: 0, totalCidades: 0 },
      vendedores,
      regioes: [],
      evolucaoGlobal: [],
      tiposContato: {},
      tiposAcao: {},
      registrosRecentes,
      listaVendedores: vendedores.map((v) => v.nome),
      listaCidades: [],
    };
  }, [rankingRpc, registrosRpc]);

  if (loadingRanking || loadingRegistros) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  return <DashboardClientesCriticos data={rpcData} filters={filters} />;
}
