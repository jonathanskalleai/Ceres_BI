import { useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useClientesPorVendedor, useRegistrosRecentes, useRankingVendedoresV2 } from "@/hooks/useComercialRpc";
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
  const { dateRange } = useNegociosFilter();

  const nome = decodeURIComponent(vendedorParam || "");
  const from = toISODate(dateRange?.from) ?? "";
  const to = toISODate(dateRange?.to) ?? "";
  const enabled = !!from && !!to && !!nome;

  const { data: clientesRpc, isLoading: loadClientes } = useClientesPorVendedor({ vendedor: nome, from, to, enabled });
  const { data: registrosRpc, isLoading: loadRegistros } = useRegistrosRecentes({ from, to, vendedor: nome, enabled });
  const { data: rankingRpc, isLoading: loadRanking } = useRankingVendedoresV2({ from, to, limit: 50, enabled });

  const registros = useMemo(() => (registrosRpc ?? []).map(mapRegistroRecente), [registrosRpc]);

  const vendedor: Vendedor | null = useMemo(() => {
    if (!rankingRpc || !clientesRpc) return null;

    const v2 = rankingRpc.find((r) => r.vendedor === nome);
    if (!v2) return null;

    // Derive evolucao from registros
    const evolMap = new Map<string, { acoes: number; visitas: number; negocioValor: number }>();
    for (const r of registros) {
      const ym = r.dtConclusao?.slice(0, 7) || "";
      if (!ym) continue;
      if (!evolMap.has(ym)) evolMap.set(ym, { acoes: 0, visitas: 0, negocioValor: 0 });
      const e = evolMap.get(ym)!;
      e.acoes++;
      if (r.tipoContato?.toLowerCase().includes("visita")) e.visitas++;
      e.negocioValor += r.negocioValor;
    }
    const evolucao: EvolucaoMensal[] = Array.from(evolMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([YearMonth, d]) => ({ YearMonth, ...d }));

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
      totalAcoes: Number(v2.acoes),
      visitas: Number(v2.visitas),
      clientes: Number(v2.clientes),
      pipeline: Number(v2.pipeline),
      negocios: Number(v2.negocios),
      conversao: v2.conversao,
      crmQuality: v2.crm_quality,
      evolucao,
      topClientes,
      regioes,
      tiposAcao,
    };
  }, [rankingRpc, clientesRpc, registros, nome]);

  const isLoading = loadClientes || loadRegistros || loadRanking;

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!vendedor) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">Consultor não encontrado.</p>
      </div>
    );
  }

  return (
    <DashboardConsultorDetail
      vendedor={vendedor}
      registros={registros}
      onBack={() => navigate("/crm/consultores")}
    />
  );
}
