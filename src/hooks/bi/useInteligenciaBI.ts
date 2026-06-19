import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { type DateRange } from "react-day-picker";

import { fetchNegociosBI, type NegocioBIRow } from "@/services/bi/negociosBIService";
import { fetchPedidosBI, type PedidoRow } from "@/services/bi/pedidosBIService";
import { fetchParqueBI, type ParqueRow } from "@/services/bi/produtosBIService";
import { fetchOrdensServico, type OrdemServicoRow } from "@/services/bi/servicosBIService";
import { useComercialData } from "@/hooks/useComercialData";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InteligenciaBIResult {
  // BLOCO 1: Funil & Esforco
  winRatePorVendedor: Array<{ name: string; ganhos: number; perdidos: number; taxa: number }>;
  motivosPerda: Array<{ name: string; valor: number; count: number }>;
  visitasPorNegocioGanho: Array<{ name: string; visitas: number; negocios: number; ratio: number }>;

  // BLOCO 2: Performance Financeira
  mixFaturamento: { financiado: number; recursoProprio: number; total: number };
  sharePorBanco: Array<{ name: string; valor: number }>;
  receitaPorCidade: Array<{ cidade: string; valor: number }>;

  // BLOCO 3: Inteligencia de Mercado
  frotaRenovacao: Array<{ marca: string; clientesComFrotaAntiga: number; totalMaquinas: number; isNossaMarca: boolean }>;

  // BLOCO 4: Pos-Venda SLA
  slaPorFilial: Array<{ filial: string; mediaDias: number; totalOS: number }>;
  slaPorTipoOS: Array<{ tipo: string; mediaDias: number; totalOS: number }>;

  isLoading: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Marcas proprias da concessionaria CNH Industrial */
const NOSSAS_MARCAS = ["CASE", "CASE IH", "NEW HOLLAND", "IVECO"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isInRange(dateStr: string | null, range: DateRange | undefined): boolean {
  if (!range?.from || !dateStr) return true; // no filter = include all
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  if (d < range.from) return false;
  if (range.to && d > range.to) return false;
  return true;
}

function dedupNegocios(rows: NegocioBIRow[]): NegocioBIRow[] {
  const seen = new Map<string, NegocioBIRow>();
  for (const r of rows) {
    if (!seen.has(r.NGO_Numero)) seen.set(r.NGO_Numero, r);
  }
  return Array.from(seen.values());
}

function isGanho(conclusao: string | null): boolean {
  return !!conclusao && conclusao.toLowerCase().includes("ganho");
}

function isPerdido(conclusao: string | null): boolean {
  return !!conclusao && conclusao.toLowerCase().includes("perdi");
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useInteligenciaBI(
  active: boolean,
  dateRange: DateRange | undefined,
  categoria?: string,
  funil?: string,
): InteligenciaBIResult {
  // --- Data fetching (shared cache via same queryKeys) ---
  const { data: negociosRaw, isLoading: loadNeg } = useQuery({
    queryKey: ["bi-negocios"],
    queryFn: fetchNegociosBI,
    staleTime: 5 * 60_000,
    enabled: active,
  });

  const { data: pedidosRaw, isLoading: loadPed } = useQuery({
    queryKey: ["bi-pedidos"],
    queryFn: fetchPedidosBI,
    staleTime: 5 * 60_000,
    enabled: active,
  });

  const { data: parqueRaw, isLoading: loadParq } = useQuery({
    queryKey: ["bi-parque"],
    queryFn: fetchParqueBI,
    staleTime: 5 * 60_000,
    enabled: active,
  });

  const { data: ordensRaw, isLoading: loadOS } = useQuery({
    queryKey: ["bi-os"],
    queryFn: fetchOrdensServico,
    staleTime: 5 * 60_000,
    enabled: active,
  });

  const { allData: comercialData } = useComercialData(categoria, funil);

  const isLoading = loadNeg || loadPed || loadParq || loadOS;

  // --- BLOCO 1: Funil & Esforco ---
  const bloco1 = useMemo(() => {
    const empty = {
      winRatePorVendedor: [] as InteligenciaBIResult["winRatePorVendedor"],
      motivosPerda: [] as InteligenciaBIResult["motivosPerda"],
      visitasPorNegocioGanho: [] as InteligenciaBIResult["visitasPorNegocioGanho"],
    };
    if (!active || !negociosRaw) return empty;

    let negocios = dedupNegocios(negociosRaw);
    // Filter by dateRange on NGO_DataFechamento
    negocios = negocios.filter((n) => isInRange(n.NGO_DataFechamento, dateRange));
    // Filter by funil
    if (funil) {
      negocios = negocios.filter((n) => n.NGO_Funil === funil);
    }

    // winRatePorVendedor
    const vendedorMap = new Map<string, { ganhos: number; perdidos: number; name: string }>();
    for (const n of negocios) {
      const nome = n.vendedorNome || "Sem vendedor";
      if (!vendedorMap.has(nome)) vendedorMap.set(nome, { ganhos: 0, perdidos: 0, name: nome });
      const entry = vendedorMap.get(nome)!;
      if (isGanho(n.NGO_Conclusao)) entry.ganhos++;
      else if (isPerdido(n.NGO_Conclusao)) entry.perdidos++;
    }
    const winRate = Array.from(vendedorMap.values())
      .map((v) => ({
        ...v,
        taxa: (v.ganhos + v.perdidos) > 0 ? Math.round((v.ganhos / (v.ganhos + v.perdidos)) * 100) : 0,
      }))
      .filter((v) => (v.ganhos + v.perdidos) > 0)
      .sort((a, b) => (b.ganhos + b.perdidos) - (a.ganhos + a.perdidos))
      .slice(0, 10);

    // motivosPerda
    const motivoMap = new Map<string, { valor: number; count: number }>();
    for (const n of negocios) {
      if (!isPerdido(n.NGO_Conclusao)) continue;
      const motivo = n.NGO_MotivoPerda?.trim();
      if (!motivo) continue;
      if (!motivoMap.has(motivo)) motivoMap.set(motivo, { valor: 0, count: 0 });
      const entry = motivoMap.get(motivo)!;
      entry.valor += n.NGO_VlrTotalNegociado ?? 0;
      entry.count++;
    }
    const motivos = Array.from(motivoMap.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    // visitasPorNegocioGanho
    const registros = comercialData?.registrosRecentes ?? [];
    const visitasPorVendedor = new Map<string, number>();
    for (const r of registros) {
      if (!r.tipoContato?.toLowerCase().includes("visita")) continue;
      if (!isInRange(r.dtConclusao, dateRange)) continue;
      const v = r.vendedor || "Sem vendedor";
      visitasPorVendedor.set(v, (visitasPorVendedor.get(v) ?? 0) + 1);
    }
    const negGanhosPorVendedor = new Map<string, number>();
    for (const n of negocios) {
      if (!isGanho(n.NGO_Conclusao)) continue;
      const nome = n.vendedorNome || "Sem vendedor";
      negGanhosPorVendedor.set(nome, (negGanhosPorVendedor.get(nome) ?? 0) + 1);
    }
    const visitasRatio: InteligenciaBIResult["visitasPorNegocioGanho"] = [];
    for (const [name, negs] of negGanhosPorVendedor) {
      const visitas = visitasPorVendedor.get(name) ?? 0;
      visitasRatio.push({ name, visitas, negocios: negs, ratio: negs > 0 ? Math.round((visitas / negs) * 10) / 10 : 0 });
    }
    visitasRatio.sort((a, b) => b.ratio - a.ratio);
    const visitasTop10 = visitasRatio.slice(0, 10);

    return { winRatePorVendedor: winRate, motivosPerda: motivos, visitasPorNegocioGanho: visitasTop10 };
  }, [active, negociosRaw, dateRange, funil, comercialData]);

  // --- BLOCO 2: Performance Financeira ---
  const bloco2 = useMemo(() => {
    const empty = {
      mixFaturamento: { financiado: 0, recursoProprio: 0, total: 0 },
      sharePorBanco: [] as InteligenciaBIResult["sharePorBanco"],
      receitaPorCidade: [] as InteligenciaBIResult["receitaPorCidade"],
    };
    if (!active || !pedidosRaw) return empty;

    const aprovados = pedidosRaw.filter(
      (p) => p.PDO_SituacaoPedido?.toLowerCase().includes("aprov") && isInRange(p.PDO_DthPedido, dateRange),
    );

    let financiado = 0;
    let recursoProprio = 0;
    let total = 0;
    const bancoMap = new Map<string, number>();
    const cidadeMap = new Map<string, number>();

    for (const p of aprovados) {
      financiado += p.PDO_VlrFinanciado ?? 0;
      recursoProprio += p.PDO_VlrRecursoProprio ?? 0;
      total += p.PDO_VlrPedido ?? 0;

      const banco = p.PDO_FinanciamentoBanco?.trim();
      if (banco) {
        bancoMap.set(banco, (bancoMap.get(banco) ?? 0) + (p.PDO_VlrFinanciado ?? 0));
      }

      const cidade = p.PDO_CidadeUFEntrega?.trim();
      if (cidade) {
        cidadeMap.set(cidade, (cidadeMap.get(cidade) ?? 0) + (p.PDO_VlrPedido ?? 0));
      }
    }

    const sharePorBanco = Array.from(bancoMap.entries())
      .map(([name, valor]) => ({ name, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 8);

    const receitaPorCidade = Array.from(cidadeMap.entries())
      .map(([cidade, valor]) => ({ cidade, valor }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 10);

    return { mixFaturamento: { financiado, recursoProprio, total }, sharePorBanco, receitaPorCidade };
  }, [active, pedidosRaw, dateRange]);

  // --- BLOCO 3: Inteligencia de Mercado ---
  const frotaRenovacao = useMemo(() => {
    if (!active || !parqueRaw) return [] as InteligenciaBIResult["frotaRenovacao"];

    const currentYear = new Date().getFullYear();
    const cutoff = currentYear - 5;

    // Filter machines with old fleet (year > 0 and < cutoff)
    const antigas = parqueRaw.filter((p) => {
      const ano = parseInt(p.PQM_Ano, 10);
      return ano > 0 && ano < cutoff;
    });

    const marcaMap = new Map<string, { clientes: Set<string>; totalMaquinas: number }>();
    for (const p of antigas) {
      const marca = p.PQM_Marca?.trim().toUpperCase() || "SEM MARCA";
      if (!marcaMap.has(marca)) marcaMap.set(marca, { clientes: new Set(), totalMaquinas: 0 });
      const entry = marcaMap.get(marca)!;
      if (p.CLI_Nome) entry.clientes.add(p.CLI_Nome);
      entry.totalMaquinas += p.PQM_QtdMaquinas ?? 1;
    }

    return Array.from(marcaMap.entries())
      .map(([marca, v]) => ({
        marca,
        clientesComFrotaAntiga: v.clientes.size,
        totalMaquinas: v.totalMaquinas,
        isNossaMarca: NOSSAS_MARCAS.includes(marca),
      }))
      .sort((a, b) => b.totalMaquinas - a.totalMaquinas)
      .slice(0, 15);
  }, [active, parqueRaw]);

  // --- BLOCO 4: Pos-Venda SLA ---
  const bloco4 = useMemo(() => {
    const empty = {
      slaPorFilial: [] as InteligenciaBIResult["slaPorFilial"],
      slaPorTipoOS: [] as InteligenciaBIResult["slaPorTipoOS"],
    };
    if (!active || !ordensRaw) return empty;

    const encerradas = ordensRaw.filter(
      (o) => o.OS_dthAbertura && o.OS_dthEncerramento && isInRange(o.OS_dthAbertura, dateRange),
    );

    const filialMap = new Map<string, { somaDias: number; count: number }>();
    const tipoMap = new Map<string, { somaDias: number; count: number }>();

    for (const o of encerradas) {
      const abertura = new Date(o.OS_dthAbertura!);
      const encerramento = new Date(o.OS_dthEncerramento!);
      if (isNaN(abertura.getTime()) || isNaN(encerramento.getTime())) continue;
      const dias = (encerramento.getTime() - abertura.getTime()) / 86_400_000;
      if (dias < 0) continue; // invalid

      const filial = o.EMP_CodFilial?.trim() || "N/A";
      if (!filialMap.has(filial)) filialMap.set(filial, { somaDias: 0, count: 0 });
      const fEntry = filialMap.get(filial)!;
      fEntry.somaDias += dias;
      fEntry.count++;

      const tipo = o.TOS_CodTipoOS?.trim() || "N/A";
      if (!tipoMap.has(tipo)) tipoMap.set(tipo, { somaDias: 0, count: 0 });
      const tEntry = tipoMap.get(tipo)!;
      tEntry.somaDias += dias;
      tEntry.count++;
    }

    const slaPorFilial = Array.from(filialMap.entries())
      .map(([filial, v]) => ({ filial, mediaDias: Math.round((v.somaDias / v.count) * 10) / 10, totalOS: v.count }))
      .sort((a, b) => b.mediaDias - a.mediaDias);

    const slaPorTipoOS = Array.from(tipoMap.entries())
      .map(([tipo, v]) => ({ tipo, mediaDias: Math.round((v.somaDias / v.count) * 10) / 10, totalOS: v.count }))
      .sort((a, b) => b.mediaDias - a.mediaDias);

    return { slaPorFilial, slaPorTipoOS };
  }, [active, ordensRaw, dateRange]);

  // --- Compose result ---
  return {
    ...bloco1,
    ...bloco2,
    ...bloco4,
    frotaRenovacao,
    isLoading,
  };
}
