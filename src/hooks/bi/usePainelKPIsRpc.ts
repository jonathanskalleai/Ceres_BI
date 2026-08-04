import { useMemo } from "react";
import { type DateRange } from "react-day-picker";
import { type CategoriaFilter, resolveFunis } from "@/lib/categoriaFunil";
import { toISODate, calcTrend, getPreviousPeriod, type Trend } from "@/lib/dateUtils";
import { makeKPI, type KPIWithPrev } from "@/lib/kpiUtils";
import { useNegociosBIRpc } from "@/hooks/bi/useNegociosBIRpc";
import { useAcoesBIRpc } from "@/hooks/bi/useAcoesBIRpc";
import { useAcoesFunilRpc } from "@/hooks/bi/useAcoesFunilRpc";
import { useOperacionalBIRpc } from "@/hooks/bi/useOperacionalBIRpc";

export interface PainelKPIs {
  // Negocios (de rpc_negocios_bi)
  totalNegocios: KPIWithPrev;
  ganhos: KPIWithPrev;
  perdidos: KPIWithPrev;
  andamento: KPIWithPrev;
  taxaConversao: KPIWithPrev;
  // Valores (de rpc_acoes_bi v9)
  valorGanho: KPIWithPrev;
  valorPerdido: KPIWithPrev;
  pipelineAberto: KPIWithPrev;
  ticketMedio: KPIWithPrev;
  // Acoes / Operacional
  totalAcoes: KPIWithPrev;
  totalVisitas: KPIWithPrev;
  totalOS: KPIWithPrev;
  porTipoAcao: Array<{ name: string; value: number; previousValue: number; trend: Trend }>;
  // Gestao (de rpc_acoes_funil_gestao v9)
  oportunidadesAbertas: KPIWithPrev;
  visitasPorOportunidade: KPIWithPrev;
  diasParados: KPIWithPrev;
  negociosOutrosStatus: number;
}

export interface UsePainelResult {
  kpis: PainelKPIs;
  isLoading: boolean;
}

/**
 * RPC-based replacement for usePainelKPIs.
 * Uses server-side aggregation via rpc_negocios_bi (Taxa Conv, Total Neg, Em Andamento)
 * e rpc_acoes_bi v9 (valorGanho, valorPerdido, ganhos, perdidos).
 * Usa rpc_acoes_funil_gestao para valorOportunidades (Pipeline Aberto logica v9).
 * Mantem useOperacionalData as-is (SQL Server, not migratable).
 */
export function usePainelKPIsRpc(
  dateRange: DateRange | undefined,
  categoria: CategoriaFilter,
  funil: string,
  vendedor?: string,
  cidade?: string,
): UsePainelResult {
  const prevDateRange = useMemo(() => getPreviousPeriod(dateRange), [dateRange]);

  // Current + previous date ISO strings
  const fromAtual = useMemo(() => toISODate(dateRange?.from), [dateRange?.from]);
  const toAtual = useMemo(() => toISODate(dateRange?.to ?? dateRange?.from), [dateRange?.to, dateRange?.from]);
  const fromAnterior = useMemo(() => toISODate(prevDateRange?.from), [prevDateRange?.from]);
  const toAnterior = useMemo(() => toISODate(prevDateRange?.to ?? prevDateRange?.from), [prevDateRange?.to, prevDateRange?.from]);

  // Funis filter from categoria + funil (mirrors ComercialSection logic)
  const funis = useMemo(() => resolveFunis(categoria, funil), [categoria, funil]);

  // Negocios — current period (mantido para Taxa Conv, Total Neg, Em Andamento)
  const { data: negAtual, isLoading: negLoad1 } = useNegociosBIRpc({
    from: fromAtual,
    to: toAtual,
    funis,
    vendedor,
    cidade,
    enabled: !!fromAtual && !!toAtual,
  });

  // Negocios — previous period
  const { data: negAnterior, isLoading: negLoad2 } = useNegociosBIRpc({
    from: fromAnterior,
    to: toAnterior,
    funis,
    vendedor,
    cidade,
    enabled: !!fromAnterior && !!toAnterior,
  });

  // Acoes — current period (v9: valorGanho, valorPerdido, negociosGanho, negociosPerdido)
  const { data: acoesAtual, isLoading: acoesLoad1 } = useAcoesBIRpc({
    from: fromAtual || undefined,
    to: toAtual || undefined,
    vendedor,
    cidade,
    enabled: true,
  });

  // Acoes — previous period
  const { data: acoesAnterior, isLoading: acoesLoad2 } = useAcoesBIRpc({
    from: fromAnterior || undefined,
    to: toAnterior || undefined,
    vendedor,
    cidade,
    enabled: true,
  });

  // Funil Gestao — current period (v9: valorOportunidades para Pipeline Aberto)
  const { data: funilAtual, isLoading: funilLoad1 } = useAcoesFunilRpc({
    from: fromAtual || undefined,
    to: toAtual || undefined,
    vendedor,
    cidade,
    enabled: true,
  });

  // Funil Gestao — previous period
  const { data: funilAnterior, isLoading: funilLoad2 } = useAcoesFunilRpc({
    from: fromAnterior || undefined,
    to: toAnterior || undefined,
    vendedor,
    cidade,
    enabled: true,
  });

  // Operacional (single period — no historical comparison available)
  const { data: opData, isLoading: opLoad } = useOperacionalBIRpc(true);

  const kpis = useMemo((): PainelKPIs => {
    const naKpis = negAtual?.kpis;
    const npKpis = negAnterior?.kpis;
    const aaKpis = acoesAtual?.kpis;
    const apKpis = acoesAnterior?.kpis;
    const faFunil = funilAtual?.funil;
    const fpFunil = funilAnterior?.funil;

    // Negocios (de rpc_negocios_bi — mantidos conforme_decisao)
    const naNeg = {
      totalNegocios: naKpis?.totalNegocios ?? 0,
      ganhos: naKpis?.ganhos ?? 0,
      perdidos: naKpis?.perdidos ?? 0,
      andamento: naKpis?.andamento ?? 0,
      taxaConversao: naKpis?.taxaConversao ?? 0,
    };
    const npNeg = {
      totalNegocios: npKpis?.totalNegocios ?? 0,
      ganhos: npKpis?.ganhos ?? 0,
      perdidos: npKpis?.perdidos ?? 0,
      andamento: npKpis?.andamento ?? 0,
      taxaConversao: npKpis?.taxaConversao ?? 0,
    };

    // Valores v9 (de rpc_acoes_bi — fonte CORRETA)
    // valorGanho: SUM(pdo_vlrpedido) de pedidos aprovados
    // valorPerdido: SUM(ngo_vlrtotalnegociado) de negocios perdidos
    const aa = {
      totalAcoes: aaKpis?.totalAcoes ?? 0,
      visitas: aaKpis?.visitas ?? 0,
      // v9: extrair de acoes kpis, nao de neg kpis
      valorGanho: aaKpis?.valorGanho ?? 0,
      valorPerdido: aaKpis?.valorPerdido ?? 0,
      negociosGanho: aaKpis?.negociosGanho ?? 0,
      negociosPerdido: aaKpis?.negociosPerdido ?? 0,
      negociosOutrosStatus: aaKpis?.negociosOutrosStatus ?? 0,
    };
    const ap = {
      totalAcoes: apKpis?.totalAcoes ?? 0,
      visitas: apKpis?.visitas ?? 0,
      // v9
      valorGanho: apKpis?.valorGanho ?? 0,
      valorPerdido: apKpis?.valorPerdido ?? 0,
      negociosGanho: apKpis?.negociosGanho ?? 0,
      negociosPerdido: apKpis?.negociosPerdido ?? 0,
    };

    // Gestao v9 (de rpc_acoes_funil_gestao)
    // Pipeline Aberto usa valorOportunidades (oportunidades abertas tocadas)
    const fa = {
      oportunidades: faFunil?.oportunidades ?? 0,
      valorOportunidades: faFunil?.valorOportunidades ?? 0,
      visitasPorOportunidade: faFunil?.visitasPorOportunidade ?? null,
      mediana: funilAtual?.diasParados?.mediana ?? null,
    };
    const fp = {
      oportunidades: fpFunil?.oportunidades ?? 0,
      valorOportunidades: fpFunil?.valorOportunidades ?? 0,
      visitasPorOportunidade: fpFunil?.visitasPorOportunidade ?? null,
      mediana: funilAnterior?.diasParados?.mediana ?? null,
    };

    // porTipoAcao with previous values
    const tipoAnteriorMap = new Map(
      (acoesAnterior?.porTipoAcao ?? []).map((t) => [t.name, t.value]),
    );
    const porTipoAcao = (acoesAtual?.porTipoAcao ?? []).map((t) => {
      const prev = tipoAnteriorMap.get(t.name) ?? 0;
      return { name: t.name, value: t.value, previousValue: prev, trend: calcTrend(t.value, prev) };
    });

    return {
      // Negocios (mantidos de rpc_negocios_bi)
      totalNegocios: makeKPI(naNeg.totalNegocios, npNeg.totalNegocios),
      ganhos: makeKPI(aa.negociosGanho, ap.negociosGanho), // v9: de acoes kpis
      perdidos: makeKPI(aa.negociosPerdido, ap.negociosPerdido), // v9: de acoes kpis
      andamento: makeKPI(naNeg.andamento, npNeg.andamento),
      taxaConversao: makeKPI(naNeg.taxaConversao, npNeg.taxaConversao),
      // Valores v9 (de rpc_acoes_bi)
      valorGanho: makeKPI(aa.valorGanho, ap.valorGanho),
      valorPerdido: makeKPI(aa.valorPerdido, ap.valorPerdido),
      // Pipeline Aberto v9: valorOportunidades do funil (oportunidades abertas tocadas)
      pipelineAberto: makeKPI(fa.valorOportunidades, fp.valorOportunidades),
      ticketMedio: makeKPI(
        aa.negociosGanho > 0 ? aa.valorGanho / aa.negociosGanho : 0,
        ap.negociosGanho > 0 ? ap.valorGanho / ap.negociosGanho : 0,
      ),
      // Acoes
      totalAcoes: makeKPI(aa.totalAcoes, ap.totalAcoes),
      totalVisitas: makeKPI(aa.visitas, ap.visitas),
      totalOS: makeKPI(opData.kpis.eventosAgenda, 0),
      porTipoAcao,
      // Gestao v9
      oportunidadesAbertas: makeKPI(fa.oportunidades, fp.oportunidades),
      visitasPorOportunidade: makeKPI(fa.visitasPorOportunidade ?? 0, fp.visitasPorOportunidade ?? 0),
      diasParados: makeKPI(fa.mediana ?? 0, fp.mediana ?? 0),
      negociosOutrosStatus: aa.negociosOutrosStatus,
    };
  }, [negAtual, negAnterior, acoesAtual, acoesAnterior, funilAtual, funilAnterior, opData]);

  const isLoading = negLoad1 || negLoad2 || acoesLoad1 || acoesLoad2 || funilLoad1 || funilLoad2 || opLoad;

  return { kpis, isLoading };
}
