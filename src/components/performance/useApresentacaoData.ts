import { useMemo } from "react";
import { DadosComerciais } from "@/types/comercial";
import { NegociosSummary } from "@/types/negociosSummary";
import { isAdminUser } from "@/lib/adminUsers";

export const META = 30_000_000;

export const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtNum = (v: number) => v.toLocaleString("pt-BR");
export const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export interface Crm2026Data {
  totalRegistros: number;
  totalClientes: number;
  totalCidades: number;
  totalVisitas: number;
  totalConsultores: number;
}

export interface EvolucaoItem {
  mes: string;
  total: number;
  valor: number;
  ganhos: number;
}

export interface ConsultorItem {
  nome: string;
  total: number;
  valor: number;
  ganhos: number;
  conversao: number;
}

export interface Neg2026Data {
  totalNegocios: number;
  totalValor: number;
  totalRecebido: number;
  totalUsado: number;
  pctUsado: number;
  pctRecebido: number;
  ganhos: number;
  emAndamento: number;
  evolucao: EvolucaoItem[];
  consultores: ConsultorItem[];
  mesesPassados: number;
}

export interface ApresentacaoData {
  crm2026: Crm2026Data;
  neg2026: Neg2026Data;
  realizado: number;
  pct: number;
  gap: number;
  mesesPassados: number;
  mediaAtual: number;
  projecao: number;
  mediaNecessaria: number;
  consultores: ConsultorItem[];
  totalRecebido: number;
  projecaoRecebido: number;
  projecaoUsados: number;
}

export function useApresentacaoData(crmData: DadosComerciais, negData: NegociosSummary): ApresentacaoData {
  const crm2026 = useMemo<Crm2026Data>(() => {
    const regs2026 = crmData.registrosRecentes.filter(r => r.dtConclusao?.startsWith("2026"));
    const clienteSet = new Set<string>();
    const cidadeSet = new Set<string>();
    const vendedorSet = new Set<string>();
    let visitas = 0;
    for (const r of regs2026) {
      if (r.cliente) clienteSet.add(r.cliente);
      if (r.cidade) cidadeSet.add(r.cidade);
      if (r.vendedor && !isAdminUser(r.vendedor)) vendedorSet.add(r.vendedor);
      if (r.tipoContato?.toLowerCase().includes("visita")) visitas++;
    }
    return {
      totalRegistros: regs2026.length,
      totalClientes: clienteSet.size,
      totalCidades: cidadeSet.size,
      totalVisitas: visitas,
      totalConsultores: vendedorSet.size,
    };
  }, [crmData]);

  const neg2026 = useMemo<Neg2026Data>(() => {
    const regs = negData.registros.filter(r => r.pdo_dth_abertura?.startsWith("2026"));
    const ganhos = regs.filter(r => r.ngo_conclusao === "Ganho");
    const emAndamento = regs.filter(r => r.ngo_conclusao === "Em andamento");
    const totalValor = regs.reduce((s, r) => s + r.valor_pedido, 0);
    const totalRecebido = regs.reduce((s, r) => s + (r.recebido || 0), 0);
    const totalUsado = regs.reduce((s, r) => s + (r.pdo_vlr_recurso_proprio || 0), 0);
    const pctUsado = totalValor > 0 ? (totalUsado / totalValor) * 100 : 0;
    const pctRecebido = totalValor > 0 ? (totalRecebido / totalValor) * 100 : 0;

    const evolMap = new Map<string, { total: number; valor: number; ganhos: number }>();
    for (const r of regs) {
      const ym = r.pdo_dth_abertura?.slice(0, 7);
      if (!ym) continue;
      if (!evolMap.has(ym)) evolMap.set(ym, { total: 0, valor: 0, ganhos: 0 });
      const e = evolMap.get(ym)!;
      e.total++;
      e.valor += r.valor_pedido;
      if (r.ngo_conclusao === "Ganho") e.ganhos++;
    }
    const evolucao = Array.from(evolMap.entries())
      .map(([mes, e]) => ({ mes, ...e }))
      .sort((a, b) => a.mes.localeCompare(b.mes));

    const cMap = new Map<string, { total: number; valor: number; ganhos: number; conversao: number }>();
    for (const r of regs) {
      if (!r.consultor || isAdminUser(r.consultor)) continue;
      if (!cMap.has(r.consultor)) cMap.set(r.consultor, { total: 0, valor: 0, ganhos: 0, conversao: 0 });
      const c = cMap.get(r.consultor)!;
      c.total++;
      c.valor += r.valor_pedido;
      if (r.ngo_conclusao === "Ganho") c.ganhos++;
    }
    const consultores = Array.from(cMap.entries())
      .map(([nome, c]) => ({ nome, ...c, conversao: c.total > 0 ? Math.round((c.ganhos / c.total) * 100) : 0 }))
      .sort((a, b) => b.valor - a.valor);

    const mesesPassados = evolucao.length || 1;

    return {
      totalNegocios: regs.length,
      totalValor,
      totalRecebido,
      totalUsado,
      pctUsado,
      pctRecebido,
      ganhos: ganhos.length,
      emAndamento: emAndamento.length,
      evolucao,
      consultores,
      mesesPassados,
    };
  }, [negData]);

  const realizado = neg2026.totalValor;
  const pct = (realizado / META) * 100;
  const gap = META - realizado;
  const mesesPassados = neg2026.mesesPassados;
  const mediaAtual = mesesPassados > 0 ? realizado / mesesPassados : 0;
  const projecao = mediaAtual * 12;
  const mediaNecessaria = gap / Math.max(1, 12 - mesesPassados);
  const consultores = neg2026.consultores;
  const totalRecebido = neg2026.totalRecebido;
  const projecaoRecebido = mesesPassados > 0 ? (totalRecebido / mesesPassados) * 12 : 0;
  const projecaoUsados = projecao - projecaoRecebido;

  return {
    crm2026,
    neg2026,
    realizado,
    pct,
    gap,
    mesesPassados,
    mediaAtual,
    projecao,
    mediaNecessaria,
    consultores,
    totalRecebido,
    projecaoRecebido,
    projecaoUsados,
  };
}
