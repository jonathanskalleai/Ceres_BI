import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardConsultores } from "@/components/dashboard/DashboardConsultores";
import { useRegistrosRecentes } from "@/hooks/useComercialRpc";
import { useConsultoresResumoAcoes } from "@/hooks/useConsultoresRpc";
import { useEquipeDesempenho } from "@/hooks/useEquipeDesempenho";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { useAuth } from "@/hooks/useAuth";
import { toISODate } from "@/lib/dateUtils";
import type { Filters, Vendedor } from "@/types/comercial";
import type { RpcConsultorResumoAcoes } from "@/types/consultoresRpc";
import type { EquipeDesempenhoData } from "@/types/equipeDesempenho";
import { Skeleton } from "@/components/ui/skeleton";
import { mapRegistroRecente } from "@/lib/comercialMappers";

const EMPTY_DESEMPENHO: EquipeDesempenhoData = { rows: [], team: [] };

function mapVendedor(resumo: RpcConsultorResumoAcoes): Vendedor {
  return {
    nome: resumo.consultor,
    totalAcoes: Number(resumo.acoes),
    visitas: Number(resumo.visitas),
    clientes: Number(resumo.clientes),
    pipeline: Number(resumo.carteira_ativa_trabalhada),
    negocios: Number(resumo.negocios_abertos_tocados),
    conversao: resumo.taxa_ganho,
    crmQuality: resumo.crm_quality,
    evolucao: [],
    topClientes: [],
    regioes: [],
    tiposAcao: {},
  };
}

/**
 * Mantém os blocos históricos da dashboard. A tabela mensal é uma carga
 * independente e server-side, posicionada apenas onde existia a grade de cards.
 */
export default function CrmConsultoresRpc() {
  const { dateRange, cidade, vendedor, tipoAcao, categoria, funil } = useNegociosFilter();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to;
  const anoDesempenho = dateRange?.from?.getFullYear() ?? new Date().getFullYear();

  const filters: Filters = {
    cidade,
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
  const { data: registrosRpc, isLoading: loadingRegistros } = useRegistrosRecentes({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    limit: 100,
    enabled,
  });
  const { data: desempenhoRpc } = useEquipeDesempenho({
    ano: anoDesempenho,
    consultor: vendedor || undefined,
    cidade: cidade || undefined,
  });

  const vendedores = useMemo<Vendedor[]>(() => (resumoRpc ?? []).map(mapVendedor), [resumoRpc]);
  const registros = useMemo(() => (registrosRpc ?? []).map(mapRegistroRecente), [registrosRpc]);

  if (loadingResumo || loadingRegistros) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-40" />)}
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
      anoDesempenho={anoDesempenho}
      desempenho={desempenhoRpc ?? EMPTY_DESEMPENHO}
      isAdmin={isAdmin}
    />
  );
}
