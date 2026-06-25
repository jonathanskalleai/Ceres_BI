import { useMemo } from "react";
import { isAdminUser } from "@/lib/adminUsers";
import { filterRegistros } from "@/lib/filterUtils";
import type { DadosComerciais, Filters } from "@/types/comercial";
import type { NegociosSummaryInput } from "@/types/performanceTypes";

interface ClientePotencial { nome: string; acoes: number; valor: number; cidade: string }
interface RegiaoOportunidade { cidade: string; totalAcoes: number; pipeline: number }

export interface Metrics {
  realizado: number; pctAtingido: number; gap: number; mesesPassados: number; mesesRestantes: number;
  mediaAtual: number; mediaNecessaria: number; projecaoAnual: number; noRitmo: boolean;
  clientesPotencial: ClientePotencial[]; regioesOportunidade: RegiaoOportunidade[]; alertas: string[];
  taxaConversao: number; negociosAbertos: number;
  totalRecebido: number; totalUsado: number; projecaoRecebido: number; pctUsadoSobreVenda: number; pctRecebidoSobreVenda: number;
}

const MESES_ANO = 12;
const REALIZADO_FALLBACK = 6_300_000;

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

export function usePerformanceMetrics(
  negociosSummary: NegociosSummaryInput | null | undefined,
  data: DadosComerciais | null | undefined,
  filters: Filters,
  metaAnual: number,
): Metrics | null {
  return useMemo(() => {
    if (!negociosSummary || !data) return null;

    const realizado = negociosSummary.totalValor || REALIZADO_FALLBACK;
    const pctAtingido = (realizado / metaAnual) * 100;
    const gap = metaAnual - realizado;
    const mesesPassados = negociosSummary.evolucaoMensal.length || 3;
    const mesesRestantes = Math.max(1, MESES_ANO - mesesPassados);
    const mediaAtual = mesesPassados > 0 ? realizado / mesesPassados : 0;
    const mediaNecessaria = mesesRestantes > 0 ? gap / mesesRestantes : 0;
    const projecaoAnual = mediaAtual * MESES_ANO;
    const noRitmo = mediaAtual >= (metaAnual / MESES_ANO);

    const totalRecebido = negociosSummary.totalRecebido;
    const totalUsado = negociosSummary.totalUsado;
    const projecaoRecebido = mesesPassados > 0 ? (totalRecebido / mesesPassados) * MESES_ANO : 0;
    const pctUsadoSobreVenda = realizado > 0 ? (totalUsado / realizado) * 100 : 0;
    const pctRecebidoSobreVenda = realizado > 0 ? (totalRecebido / realizado) * 100 : 0;

    const consultores = (negociosSummary.porConsultor || []).filter(c => !isAdminUser(c.nome));
    const regs = data ? filterRegistros(data.registrosRecentes, filters) : [];

    // Clientes com potencial (alto volume de acoes sem negocio fechado)
    const clienteAcoes = new Map<string, { acoes: number; valor: number; cidade: string }>();
    for (const r of regs) {
      if (!clienteAcoes.has(r.cliente)) clienteAcoes.set(r.cliente, { acoes: 0, valor: 0, cidade: r.cidade });
      const c = clienteAcoes.get(r.cliente)!;
      c.acoes++;
      c.valor += r.negocioValor;
    }
    const clientesPotencial = Array.from(clienteAcoes.entries())
      .filter(([, c]) => c.acoes >= 3 && c.valor === 0)
      .sort((a, b) => b[1].acoes - a[1].acoes)
      .slice(0, 10)
      .map(([nome, c]) => ({ nome, ...c }));

    const regioesOportunidade = (data?.regioes || [])
      .filter(r => r.totalAcoes > 5 && r.pipeline === 0)
      .sort((a, b) => b.totalAcoes - a.totalAcoes)
      .slice(0, 8);

    // Alertas
    const alertas: string[] = [];
    for (const c of consultores) {
      if (c.conversao < 5 && c.total > 0) alertas.push(`${c.nome}: conversao de apenas ${fmtPct(c.conversao)}`);
    }
    const vendedoresCRM = (data?.vendedores || []).filter(v => !isAdminUser(v.nome));
    for (const v of vendedoresCRM) {
      const neg = consultores.find(c => c.nome === v.nome);
      if (v.visitas > 20 && (!neg || neg.total === 0)) {
        alertas.push(`${v.nome}: ${v.visitas} visitas sem nenhum negocio fechado`);
      }
    }
    if (pctUsadoSobreVenda > 30) {
      alertas.push(`${fmtPct(pctUsadoSobreVenda)} do faturamento esta comprometido com equipamentos usados recebidos como parte de pagamento`);
    }

    return {
      realizado, pctAtingido, gap, mesesPassados, mesesRestantes,
      mediaAtual, mediaNecessaria, projecaoAnual, noRitmo,
      clientesPotencial, regioesOportunidade, alertas,
      taxaConversao: negociosSummary.taxaConversao,
      negociosAbertos: negociosSummary.emAndamento,
      totalRecebido, totalUsado, projecaoRecebido, pctUsadoSobreVenda, pctRecebidoSobreVenda,
    };
  }, [negociosSummary, data, filters, metaAnual]);
}
