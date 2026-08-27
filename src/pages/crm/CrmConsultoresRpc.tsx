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
import { useDelayedReady } from "@/hooks/useDelayedReady";

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
 * Carrega a visão de consultores e equipe com renderização progressiva.
 * Apenas o resumo principal bloqueia a casca; registros detalhados hidratam sob demanda.
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
    vendedor,
    tipoAcao,
    categoria,
    funil,
    dateRange: from && to ? { from, to } : undefined,
  };

  const { data: resumoRpc, isLoading: loadingResumo, isFetching: fetchingResumo } = useConsultoresResumoAcoes({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    tipoAcao: tipoAcao || undefined,
    enabled,
  });

  const { data: registrosRpc } = useRegistrosRecentes({
    from,
    to,
    vendedor: vendedor || undefined,
    cidade: cidade || undefined,
    limit: 100,
    enabled,
  });

  // O desempenho anual e a maior resposta da tela. O resumo mensal acima
  // libera a casca primeiro; só depois iniciamos esta consulta para evitar
  // concorrer com o carregamento que define a primeira pintura.
  const desempenhoReady = useDelayedReady(
    enabled && !!resumoRpc && !fetchingResumo,
    120,
    `${from}|${to}|${anoDesempenho}|${vendedor}|${cidade}`,
  );
  const { data: desempenhoRpc, isLoading: loadingDesempenho } = useEquipeDesempenho({
    ano: anoDesempenho,
    consultor: vendedor || undefined,
    cidade: cidade || undefined,
    enabled: enabled && desempenhoReady,
  });

  const vendedores = useMemo<Vendedor[]>(() => (resumoRpc ?? []).map(mapVendedor), [resumoRpc]);
  const registros = useMemo(() => (registrosRpc ?? []).map(mapRegistroRecente), [registrosRpc]);

  if (loadingResumo && !resumoRpc) {
    return (
      <div className="space-y-6 p-6 max-w-[1920px] mx-auto">
        <Skeleton className="h-8 w-64 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
          <Skeleton className="h-64 rounded-2xl" />
        </div>
        <div className="grid grid-cols-5 gap-3.5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-80 rounded-2xl" />
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
      desempenhoLoading={!!resumoRpc && (!desempenhoReady || loadingDesempenho)}
      isAdmin={isAdmin}
    />
  );
}
