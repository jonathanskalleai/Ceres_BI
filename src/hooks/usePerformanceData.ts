import { useMemo } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { useNegociosCrm } from "@/hooks/useNegociosCrm";
import { useRankingVendedoresV2, useRegistrosRecentes, useRankingRegioes } from "@/hooks/useComercialRpc";
import { useListasFiltrosRpc } from "@/hooks/useListasFiltrosRpc";
import { mapRegistroRecente } from "@/lib/comercialMappers";
import { fetchNegociosMensais } from "@/services/negociosService";
import type { DadosComerciais, Vendedor } from "@/types/comercial";
import type { NegociosSummary, NegocioRow } from "@/types/negociosSummary";
import type { NegociosSummaryInput } from "@/types/performanceTypes";

interface PerformanceDataOptions {
  from: string;
  to: string;
  cidade?: string;
  apresentacaoActive: boolean;
}

function aggregateNegociosRows(rows: NegocioRow[]): NegociosSummary {
  const ganhos = rows.filter((r) => r.ngo_conclusao === "Ganho");
  const emAndamento = rows.filter((r) => r.ngo_conclusao === "Em andamento");
  const totalValor = rows.reduce((s, r) => s + r.valor_pedido, 0);
  const totalRecebido = rows.reduce((s, r) => s + r.recebido, 0);
  const totalUsado = rows.reduce((s, r) => s + Math.max(0, r.valor_pedido - r.recebido), 0);
  const percentUsado = totalValor > 0 ? (totalUsado / totalValor) * 100 : 0;
  const clientesSet = new Set(rows.map((r) => r.cliente).filter(Boolean));

  const evolMap = new Map<string, { total: number; valor: number; ganhos: number }>();
  for (const r of rows) {
    const ym = r.pdo_dth_abertura?.slice(0, 7);
    if (!ym) continue;
    if (!evolMap.has(ym)) evolMap.set(ym, { total: 0, valor: 0, ganhos: 0 });
    const e = evolMap.get(ym)!;
    e.total++; e.valor += r.valor_pedido;
    if (r.ngo_conclusao === "Ganho") e.ganhos++;
  }

  const cMap = new Map<string, { total: number; valor: number; ganhos: number }>();
  for (const r of rows) {
    if (!r.consultor) continue;
    if (!cMap.has(r.consultor)) cMap.set(r.consultor, { total: 0, valor: 0, ganhos: 0 });
    const c = cMap.get(r.consultor)!;
    c.total++; c.valor += r.valor_pedido;
    if (r.ngo_conclusao === "Ganho") c.ganhos++;
  }

  return {
    totalNegocios: rows.length,
    totalValor,
    ticketMedio: rows.length > 0 ? totalValor / rows.length : 0,
    ganhos: ganhos.length,
    emAndamento: emAndamento.length,
    perdidos: rows.filter((r) => r.ngo_conclusao === "Perdido").length,
    taxaConversao: clientesSet.size > 0 ? Math.round((rows.length / clientesSet.size) * 100) : 0,
    clientesAtendidos: clientesSet.size,
    totalRecebido,
    totalUsado,
    percentUsado,
    evolucaoMensal: Array.from(evolMap.entries()).map(([mes, e]) => ({ mes, ...e })).sort((a, b) => a.mes.localeCompare(b.mes)),
    porConsultor: Array.from(cMap.entries()).map(([nome, c]) => ({
      nome, total: c.total, valor: c.valor, ganhos: c.ganhos,
      conversao: c.total > 0 ? Math.round((c.ganhos / c.total) * 100) : 0,
      ticketMedio: c.total > 0 ? c.valor / c.total : 0,
      clientesAtendidos: 0, recebido: 0, usado: 0, percentUsado: 0, clientes: [],
    })).sort((a, b) => b.valor - a.valor),
    porRegiao: [],
    porTipo: [],
    registros: rows,
  };
}

export function usePerformanceData({ from, to, cidade, apresentacaoActive }: PerformanceDataOptions) {
  // ── RPC: Negocios (summary, porConsultor, evolucao) ──
  const { data: negociosRpc, isLoading: loadingNeg, error: negError } = useNegociosCrm({
    dateRange: { from: new Date(from), to: new Date(to) },
    cidade,
  });

  // ── RPC: CRM data for DadosComerciais shell ──
  const { data: rankingRpc, isLoading: loadingRanking } = useRankingVendedoresV2({ from, to, enabled: true });
  const { data: registrosRpc, isLoading: loadingRegistros } = useRegistrosRecentes({ from, to, cidade, enabled: true });
  const { data: regioesRpc, isLoading: loadingRegioes } = useRankingRegioes({ from, to, enabled: true });
  const { data: listasFiltros } = useListasFiltrosRpc({ from, to, enabled: true });

  // ── Raw negocios for Apresentacao tab (lazy) ──
  const { data: rawNegocios, isLoading: loadingRaw } = useQuery({
    queryKey: ["negocios-mensais-raw", from, to],
    queryFn: () => fetchNegociosMensais({ from, to }),
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
    enabled: apresentacaoActive,
  });

  // ── Build NegociosSummaryInput for usePerformanceMetrics ──
  const negociosSummaryInput = useMemo<NegociosSummaryInput | null>(() => {
    if (!negociosRpc) return null;
    return {
      totalValor: negociosRpc.summary.totalValor,
      totalRecebido: negociosRpc.summary.totalRecebido,
      totalUsado: negociosRpc.summary.totalUsado,
      evolucaoMensal: negociosRpc.evolucaoMensal,
      taxaConversao: negociosRpc.summary.taxaConversao,
      emAndamento: negociosRpc.summary.emAndamento,
      porConsultor: negociosRpc.porConsultor.map((c) => ({
        nome: c.nome,
        total: c.total,
        conversao: c.conversao,
      })),
    };
  }, [negociosRpc]);

  // ── Build DadosComerciais shell ──
  const crmData = useMemo<DadosComerciais | null>(() => {
    if (!registrosRpc) return null;
    const registrosRecentes = registrosRpc.map(mapRegistroRecente);
    const vendedores: Vendedor[] = (rankingRpc ?? []).map((r) => ({
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
    }));
    const regioes = (regioesRpc ?? []).map((r) => ({
      cidade: r.cidade,
      totalAcoes: Number(r.acoes),
      clientes: Number(r.clientes),
      pipeline: Number(r.valor),
      visitas: Number(r.visitas),
      lat: r.lat ?? undefined,
      lng: r.lng ?? undefined,
    }));

    return {
      kpis: { totalRegistros: registrosRecentes.length, totalClientes: 0, totalConsultores: vendedores.length, totalPipeline: 0, totalVisitas: 0, totalCidades: 0 },
      vendedores,
      regioes,
      evolucaoGlobal: [],
      tiposContato: {},
      tiposAcao: {},
      registrosRecentes,
      listaVendedores: vendedores.map((v) => v.nome),
      listaCidades: listasFiltros?.cidades ?? [],
    };
  }, [registrosRpc, rankingRpc, regioesRpc, listasFiltros]);

  // ── Build NegociosSummary for Apresentacao2026 (only when tab active) ──
  const negociosSummaryFull = useMemo<NegociosSummary | null>(() => {
    if (!rawNegocios) return null;
    return aggregateNegociosRows(rawNegocios);
  }, [rawNegocios]);

  const isLoading = loadingNeg || loadingRanking || loadingRegistros || loadingRegioes;
  const error = negError?.message || null;

  return {
    negociosSummaryInput,
    crmData,
    negociosSummaryFull,
    isLoading,
    loadingRaw,
    error,
  };
}
