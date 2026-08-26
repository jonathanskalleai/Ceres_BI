import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesPorVendedor, useRegistrosRecentes, useEvolucaoMensal } from "@/hooks/useComercialRpc";
import { useConsultoresResumoAcoes } from "@/hooks/useConsultoresRpc";
import { useEquipeDesempenho } from "@/hooks/useEquipeDesempenho";
import { useNegociosFilter } from "@/contexts/NegociosFilterContext";
import { toISODate } from "@/lib/dateUtils";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import { DashboardConsultorDetail } from "@/components/dashboard/DashboardConsultorDetail";
import { Skeleton } from "@/components/ui/skeleton";
import type { Vendedor, TopCliente, EvolucaoMensal, RegiaoVendedor } from "@/types/comercial";
import type { RpcClienteVendedor } from "@/types/comercialRpc";

function mapTopCliente(c: RpcClienteVendedor): TopCliente {
  return {
    nome: c.cliente,
    cidade: c.cidade,
    acoes: Number(c.acoes),
    visitas: Number(c.visitas),
    negocioValor: Number(c.valor),
    diasSemContato: c.dias_sem_contato,
  };
}

export default function CrmConsultorDetail() {
  const { vendedor: vendedorParam } = useParams<{ vendedor: string }>();
  const navigate = useNavigate();
  const { dateRange, cidade, tipoAcao } = useNegociosFilter();

  const nome = decodeURIComponent(vendedorParam || "");
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to && !!nome;
  const anoDesempenho = dateRange?.from?.getFullYear() ?? new Date().getFullYear();

  const { data: clientesRpc, isLoading: loadClientes } = useClientesPorVendedor({ vendedor: nome, from, to, enabled });
  const { data: registrosRpc, isLoading: loadRegistros } = useRegistrosRecentes({ from, to, vendedor: nome, enabled });
  const { data: resumoRpc, isLoading: loadResumo } = useConsultoresResumoAcoes({
    from,
    to,
    vendedor: nome,
    cidade: cidade || undefined,
    tipoAcao: tipoAcao || undefined,
    enabled,
  });

  // Evolução mensal no ano corrente de Janeiro a Dezembro
  const { data: evolucaoRpc, isLoading: loadEvolucao } = useEvolucaoMensal({
    from: `${anoDesempenho}-01-01`,
    to: `${anoDesempenho}-12-31`,
    vendedor: nome,
    enabled: !!nome,
  });

  // Dados de metas e pipeline detalhados do consultor
  const { data: desempenhoRpc, isLoading: loadDesempenho } = useEquipeDesempenho({
    ano: anoDesempenho,
    consultor: nome || undefined,
    cidade: cidade || undefined,
  });

  const registros = useMemo(() => (registrosRpc ?? []).map(mapRegistroRecente), [registrosRpc]);
  const resumoConsultor = useMemo(
    () => resumoRpc?.find((item) => item.consultor === nome) ?? null,
    [resumoRpc, nome],
  );

  const evolucao: EvolucaoMensal[] = useMemo(
    () =>
      (evolucaoRpc ?? []).map((d) => ({
        YearMonth: d.mes,
        acoes: Number(d.acoes),
        visitas: Number(d.visitas),
        negocioValor: Number(d.valor),
        clientes: Number(d.clientes),
      })),
    [evolucaoRpc],
  );

  const vendedor: Vendedor | null = useMemo(() => {
    if (!resumoRpc || !clientesRpc) return null;

    const resumo = resumoConsultor;
    if (!resumo) return null;

    // Derive tiposAcao from registros
    const tiposAcao: Record<string, number> = {};
    for (const r of registros) {
      if (r.tipoAcao) tiposAcao[r.tipoAcao] = (tiposAcao[r.tipoAcao] || 0) + 1;
    }

    // Derive regioes from registros
    const regMap = new Map<string, { acoes: number; valor: number; clientes: Set<string> }>();
    for (const r of registros) {
      if (!r.cidade) continue;
      if (!regMap.has(r.cidade)) regMap.set(r.cidade, { acoes: 0, valor: 0, clientes: new Set() });
      const rg = regMap.get(r.cidade)!;
      rg.acoes++;
      rg.valor += r.negocioValor;
      rg.clientes.add(r.cliente);
    }
    const regioes: RegiaoVendedor[] = Array.from(regMap.entries())
      .map(([cidade, d]) => ({ cidade, acoes: d.acoes, valor: d.valor, clientes: d.clientes.size }))
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 10);

    const topClientes = (clientesRpc ?? [])
      .map(mapTopCliente)
      .sort((a, b) => b.acoes - a.acoes)
      .slice(0, 10);

    return {
      nome,
      totalAcoes: Number(resumo.acoes),
      visitas: Number(resumo.visitas),
      clientes: Number(resumo.clientes),
      pipeline: Number(resumo.carteira_ativa_trabalhada),
      negocios: Number(resumo.negocios_abertos_tocados),
      conversao: resumo.taxa_ganho,
      crmQuality: resumo.crm_quality,
      evolucao,
      topClientes,
      regioes,
      tiposAcao,
    };
  }, [resumoConsultor, clientesRpc, registros, evolucao, nome]);

  const isLoading = loadClientes || loadRegistros || loadResumo || loadEvolucao || loadDesempenho;

  if (isLoading && !vendedor) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-36 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  if (!vendedor || !resumoConsultor) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Consultor não encontrado.</p>
      </div>
    );
  }

  return (
    <DashboardConsultorDetail
      vendedor={vendedor}
      resumo={resumoConsultor}
      desempenho={desempenhoRpc}
      anoDesempenho={anoDesempenho}
      registros={registros}
      from={from}
      to={to}
      onBack={() => navigate("/crm/consultores")}
    />
  );
}
