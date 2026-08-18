import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardConsultores } from "@/components/dashboard/DashboardConsultores";
import { useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useConsultoresResumoAcoes } from "@/hooks/useConsultoresRpc";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import type { Filters, Vendedor } from "@/types/comercial";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";

/**
 * Maps the Acoes-aligned consultant summary to the existing UI domain shape.
 * The pipeline is Carteira Ativa Trabalhada, never a sum of action values.
 */
function mapVendedor(r: RpcConsultorResumoAcoes): Vendedor {
  return {
    nome: r.consultor,
    totalAcoes: Number(r.acoes),
    visitas: Number(r.visitas),
    clientes: Number(r.clientes),
    pipeline: Number(r.carteira_ativa_trabalhada),
    negocios: Number(r.negocios_abertos_tocados),
    conversao: r.taxa_ganho,
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
  const { dateRange, cidade, vendedor, tipoAcao, categoria, funil } = useNegociosFilter();
  const navigate = useNavigate();

  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to;

  const filters: Filters = {
    cidade: cidade,
    tipoAcao,
    categoria,
    funil,
    dateRange: from && to ? { from, to } : undefined,
  };

  const { data: resumoRpc, isLoading: loadingResumo } = useConsultoresResumoAcoes({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    tipoAcao: tipoAcao || undefined,
    enabled,
  });

  // Registro detalhado permanece somente para o ranking navegavel de clientes.
  // Os cards e o Top 5 usam exclusivamente os agregados server-side acima.
  const { data: registrosRpc, isLoading: loadingRegistros } = useRegistrosRecentes({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    limit: 100,
    enabled,
  });

  const vendedores = useMemo<Vendedor[]>(
    () => (resumoRpc ?? []).map(mapVendedor),
    [resumoRpc],
  );

  const registros = useMemo(
    () => (registrosRpc ?? []).map(mapRegistroRecente),
    [registrosRpc],
  );

  if (loadingResumo || loadingRegistros) {
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
      resumo={resumoRpc ?? []}
      onSelectConsultor={(nome) => navigate(`/crm/consultores/${encodeURIComponent(nome)}`)}
    />
  );
}
