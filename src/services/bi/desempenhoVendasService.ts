import { supabase } from "@/integrations/supabase/client";
import type {
  DesempenhoVendasData,
  DesempenhoVendasFilterOptions,
} from "@/types/desempenhoVendas";

export const EMPTY_DESEMPENHO_DATA: DesempenhoVendasData = {
  kpis: {
    faturamento: 0,
    totalPedidos: 0,
    ticketMedio: 0,
    valorFinanciado: 0,
    valorRecursoProprio: 0,
    percentFinanciado: 0,
    valorPerdido: 0,
    pipelineAberto: 0,
  },
  rankingVendedores: [],
  rankingProdutos: [],
  rankingCidades: [],
  origensLead: [],
  financiamentoBancos: [],
  tiposCliente: [],
  motivosPerda: [],
  resumoAnual: [],
};

/**
 * Busca dados consolidados de desempenho de vendas via RPC ou fallback direto nas tabelas mirror.
 */
export async function fetchDesempenhoVendas(
  options: DesempenhoVendasFilterOptions = {}
): Promise<DesempenhoVendasData> {
  try {
    const params: Record<string, unknown> = {};
    if (options.from) params.p_from = options.from;
    if (options.to) params.p_to = options.to;
    if (options.ano) params.p_ano = options.ano;
    if (options.vendedor) params.p_vendedor = options.vendedor;
    if (options.cidade) params.p_cidade = options.cidade;
    if (options.condicao) params.p_condicao = options.condicao;

    const { data, error } = await supabase.rpc("rpc_desempenho_vendas_bi", params);
    if (!error && data) {
      const raw = Array.isArray(data) ? data[0] : data;
      return {
        ...EMPTY_DESEMPENHO_DATA,
        ...(raw as Partial<DesempenhoVendasData>),
        kpis: { ...EMPTY_DESEMPENHO_DATA.kpis, ...(raw as Partial<DesempenhoVendasData>)?.kpis },
      };
    }

    // Se a RPC falhar ou ainda não tiver sido migrada na VPS, agregamos via tabelas mirror locais
    return await fetchDesempenhoVendasFallback(options);
  } catch (err) {
    console.warn("[desempenhoVendasService] RPC failed, running fallback aggregator:", err);
    return await fetchDesempenhoVendasFallback(options);
  }
}

/**
 * Agregador fallback via PostgREST direto no schema mirror.
 */
async function fetchDesempenhoVendasFallback(
  options: DesempenhoVendasFilterOptions
): Promise<DesempenhoVendasData> {
  try {
    let pedidosQuery = supabase
      .schema("mirror")
      .from("crm_pedidos")
      .select(
        "pdo_codigointerno, ngo_numero, pdo_situacaopedido, pdo_vlrpedido, pdo_vlrfinanciado, pdo_vlrrecursoproprio, pdo_dthpedido, pdo_vendedor, pdo_cidadeufentrega, pdo_financiamentobanco, emp_cidade"
      );

    let negociosQuery = supabase
      .schema("mirror")
      .from("crm_negocios")
      .select(
        "ngo_numero, ngo_conclusao, ngo_vlrtotalnegociado, ngo_formaentrada, ngo_campanha, ngo_motivoperda, mpp_produtoperdamarca, cli_tipocliente, prd_condicaoproduto, ngo_vendedores, cli_cidade, emp_cidade, ngo_datafechamento, ngo_datacadastro"
      );

    if (options.from) {
      pedidosQuery = pedidosQuery.gte("pdo_dthpedido", options.from);
      negociosQuery = negociosQuery.gte("ngo_datafechamento", options.from);
    }
    if (options.to) {
      pedidosQuery = pedidosQuery.lte("pdo_dthpedido", `${options.to}T23:59:59.999`);
      negociosQuery = negociosQuery.lte("ngo_datafechamento", `${options.to}T23:59:59.999`);
    }

    const [pedidosRes, negociosRes, itensRes] = await Promise.all([
      pedidosQuery.limit(5000),
      negociosQuery.limit(5000),
      supabase
        .schema("mirror")
        .from("crm_pedidos_item")
        .select("pdo_codigo_interno, pdo_itemdescricao, pdo_itemmarca, pdo_itemgrupo, pdo_itemmodelo, pdo_itemqtde, pdo_itemvlrunitario")
        .limit(10000),
    ]);

    const rawPedidos = pedidosRes.data ?? [];
    const rawNegocios = negociosRes.data ?? [];
    const rawItens = itensRes.data ?? [];

    // Filtros adicionais em memória se aplicável
    const pedidos = rawPedidos.filter((p) => {
      if (options.ano && p.pdo_dthpedido) {
        const ano = new Date(p.pdo_dthpedido).getFullYear();
        if (ano !== options.ano) return false;
      }
      if (options.vendedor && !p.pdo_vendedor?.toLowerCase().includes(options.vendedor.toLowerCase())) {
        return false;
      }
      if (options.cidade) {
        const match =
          p.pdo_cidadeufentrega?.toLowerCase().includes(options.cidade.toLowerCase()) ||
          p.emp_cidade?.toLowerCase().includes(options.cidade.toLowerCase());
        if (!match) return false;
      }
      return true;
    });

    const pedidosAprovados = pedidos.filter((p) =>
      p.pdo_situacaopedido?.toLowerCase().includes("aprovado")
    );

    const faturamentoTotal = pedidosAprovados.reduce((acc, p) => acc + (Number(p.pdo_vlrpedido) || 0), 0);
    const financiadoTotal = pedidosAprovados.reduce((acc, p) => acc + (Number(p.pdo_vlrfinanciado) || 0), 0);
    const proprioTotal = pedidosAprovados.reduce((acc, p) => acc + (Number(p.pdo_vlrrecursoproprio) || 0), 0);
    const totalPedidosAprovados = pedidosAprovados.length;
    const ticketMedioGeral = totalPedidosAprovados > 0 ? faturamentoTotal / totalPedidosAprovados : 0;

    // Negócios dedup
    const dedupNegociosMap = new Map<string, typeof rawNegocios[0]>();
    for (const n of rawNegocios) {
      if (!dedupNegociosMap.has(n.ngo_numero)) {
        dedupNegociosMap.set(n.ngo_numero, n);
      }
    }
    const negociosList = Array.from(dedupNegociosMap.values());

    const valorPerdido = negociosList
      .filter((n) => n.ngo_conclusao?.toLowerCase().includes("perd"))
      .reduce((acc, n) => acc + (Number(n.ngo_vlrtotalnegociado) || 0), 0);

    const pipelineAberto = negociosList
      .filter((n) => !n.ngo_conclusao?.toLowerCase().includes("perd") && !n.ngo_conclusao?.toLowerCase().includes("ganh"))
      .reduce((acc, n) => acc + (Number(n.ngo_vlrtotalnegociado) || 0), 0);

    // 1. Ranking Vendedores
    const vendedorMap = new Map<string, { qtd: number; valor: number }>();
    for (const p of pedidosAprovados) {
      const vend = p.pdo_vendedor?.trim() || "Não Informado";
      const cur = vendedorMap.get(vend) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(p.pdo_vlrpedido) || 0;
      vendedorMap.set(vend, cur);
    }
    const rankingVendedores = Array.from(vendedorMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        valor: data.valor,
        percent: faturamentoTotal > 0 ? Number(((data.valor / faturamentoTotal) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 2. Ranking Cidades
    const cidadeMap = new Map<string, { qtd: number; valor: number }>();
    for (const p of pedidosAprovados) {
      const cid = p.pdo_cidadeufentrega?.trim() || p.emp_cidade?.trim() || "Não Informada";
      const cur = cidadeMap.get(cid) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(p.pdo_vlrpedido) || 0;
      cidadeMap.set(cid, cur);
    }
    const rankingCidades = Array.from(cidadeMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        valor: data.valor,
        percent: faturamentoTotal > 0 ? Number(((data.valor / faturamentoTotal) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 3. Ranking Produtos (cruzar com itens de pedidos aprovados)
    const aprovadosCodigos = new Set(pedidosAprovados.map((p) => p.pdo_codigointerno));
    const itemMap = new Map<string, { marca?: string; grupo?: string; qtd: number; valor: number }>();

    for (const item of rawItens) {
      if (!aprovadosCodigos.has(item.pdo_codigo_interno)) continue;
      const desc = item.pdo_itemdescricao?.trim() || item.pdo_itemmodelo?.trim() || item.pdo_itemgrupo?.trim() || "Produto sem Descrição";
      const qtd = Math.max(1, Number(item.pdo_itemqtde) || 1);
      const vlrUnit = Number(item.pdo_itemvlrunitario) || 0;
      const vlrTotal = vlrUnit * qtd;

      const cur = itemMap.get(desc) || { marca: item.pdo_itemmarca || undefined, grupo: item.pdo_itemgrupo || undefined, qtd: 0, valor: 0 };
      cur.qtd += qtd;
      cur.valor += vlrTotal;
      itemMap.set(desc, cur);
    }

    const rankingProdutos = Array.from(itemMap.entries())
      .map(([name, data]) => ({
        name,
        marca: data.marca,
        grupo: data.grupo,
        qtd: data.qtd,
        valor: data.valor,
        percent: faturamentoTotal > 0 ? Number(((data.valor / faturamentoTotal) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor)
      .slice(0, 20);

    // 4. Origens do Lead
    const origemMap = new Map<string, { qtd: number; qtdGanhos: number; valorGanho: number }>();
    for (const n of negociosList) {
      const orig = n.ngo_formaentrada?.trim() || "Não Informada";
      const isGanho = n.ngo_conclusao?.toLowerCase().includes("ganh");
      const vlr = Number(n.ngo_vlrtotalnegociado) || 0;

      const cur = origemMap.get(orig) || { qtd: 0, qtdGanhos: 0, valorGanho: 0 };
      cur.qtd += 1;
      if (isGanho) {
        cur.qtdGanhos += 1;
        cur.valorGanho += vlr;
      }
      origemMap.set(orig, cur);
    }
    const totalGanhosValor = Array.from(origemMap.values()).reduce((a, b) => a + b.valorGanho, 0);

    const origensLead = Array.from(origemMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        qtdGanhos: data.qtdGanhos,
        taxaConversao: data.qtd > 0 ? Number(((data.qtdGanhos / data.qtd) * 100).toFixed(1)) : 0,
        valor: data.valorGanho,
        percent: totalGanhosValor > 0 ? Number(((data.valorGanho / totalGanhosValor) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtdGanhos > 0 ? Number((data.valorGanho / data.qtdGanhos).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 5. Financiamento e Bancos
    const bancoMap = new Map<string, { qtd: number; valor: number }>();
    for (const p of pedidosAprovados) {
      const vlrFin = Number(p.pdo_vlrfinanciado) || 0;
      if (vlrFin <= 0) continue;
      const banco = p.pdo_financiamentobanco?.trim() || "Não Informado";
      const cur = bancoMap.get(banco) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += vlrFin;
      bancoMap.set(banco, cur);
    }
    const financiamentoBancos = Array.from(bancoMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        valor: data.valor,
        percent: financiadoTotal > 0 ? Number(((data.valor / financiadoTotal) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 6. Tipos de Cliente
    const tipoCliMap = new Map<string, { qtd: number; valor: number }>();
    for (const n of negociosList) {
      if (!n.ngo_conclusao?.toLowerCase().includes("ganh")) continue;
      const tipo = n.cli_tipocliente?.trim() || "Produtor Rural";
      const vlr = Number(n.ngo_vlrtotalnegociado) || 0;
      const cur = tipoCliMap.get(tipo) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += vlr;
      tipoCliMap.set(tipo, cur);
    }
    const tiposCliente = Array.from(tipoCliMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        valor: data.valor,
        percent: totalGanhosValor > 0 ? Number(((data.valor / totalGanhosValor) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 7. Motivos de Perda
    const perdaMap = new Map<string, { concorrente?: string; qtd: number; valor: number }>();
    for (const n of negociosList) {
      if (!n.ngo_conclusao?.toLowerCase().includes("perd")) continue;
      const motivo = n.ngo_motivoperda?.trim() || "Outros / Sem Motivo";
      const conc = n.mpp_produtoperdamarca?.trim() || undefined;
      const vlr = Number(n.ngo_vlrtotalnegociado) || 0;
      const cur = perdaMap.get(motivo) || { concorrente: conc, qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += vlr;
      perdaMap.set(motivo, cur);
    }
    const motivosPerda = Array.from(perdaMap.entries())
      .map(([name, data]) => ({
        name,
        concorrenteTop: data.concorrente,
        qtd: data.qtd,
        valor: data.valor,
        percent: valorPerdido > 0 ? Number(((data.valor / valorPerdido) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 8. Resumo Anual
    const anoMap = new Map<number, { qtd: number; faturamento: number }>();
    for (const p of rawPedidos) {
      if (!p.pdo_situacaopedido?.toLowerCase().includes("aprovado") || !p.pdo_dthpedido) continue;
      const ano = new Date(p.pdo_dthpedido).getFullYear();
      if (isNaN(ano)) continue;
      const cur = anoMap.get(ano) || { qtd: 0, faturamento: 0 };
      cur.qtd += 1;
      cur.faturamento += Number(p.pdo_vlrpedido) || 0;
      anoMap.set(ano, cur);
    }
    const resumoAnual = Array.from(anoMap.entries())
      .map(([ano, data]) => ({
        ano,
        qtd: data.qtd,
        faturamento: data.faturamento,
        ticketMedio: data.qtd > 0 ? Number((data.faturamento / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.ano - a.ano);

    return {
      kpis: {
        faturamento: faturamentoTotal,
        totalPedidos: totalPedidosAprovados,
        ticketMedio: ticketMedioGeral,
        valorFinanciado: financiadoTotal,
        valorRecursoProprio: proprioTotal,
        percentFinanciado: faturamentoTotal > 0 ? Number(((financiadoTotal / faturamentoTotal) * 100).toFixed(1)) : 0,
        valorPerdido,
        pipelineAberto,
      },
      rankingVendedores,
      rankingProdutos,
      rankingCidades,
      origensLead,
      financiamentoBancos,
      tiposCliente,
      motivosPerda,
      resumoAnual,
    };
  } catch (error) {
    console.error("[desempenhoVendasService] Fallback calculation failed:", error);
    return EMPTY_DESEMPENHO_DATA;
  }
}
