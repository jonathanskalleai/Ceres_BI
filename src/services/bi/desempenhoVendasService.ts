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
    qtdPerdido: 0,
    pipelineAberto: 0,
  },
  serieMensal: [],
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
 * Busca dados consolidados de desempenho de vendas via RPC com fallback resiliente.
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
        serieMensal: (raw as Partial<DesempenhoVendasData>)?.serieMensal ?? [],
        rankingProdutos: (raw as Partial<DesempenhoVendasData>)?.rankingProdutos ?? [],
      };
    }

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
    const [pedidosRes, negociosRes, itensRes] = await Promise.all([
      supabase
        .schema("mirror")
        .from("crm_pedidos")
        .select(
          "pdo_codigointerno, ngo_numero, pdo_situacaopedido, pdo_vlrpedido, pdo_vlrfinanciado, pdo_vlrrecursoproprio, pdo_dthpedido, pdo_dthaprovacao, pdo_vendedor, pdo_cidadeufentrega, pdo_financiamentobanco, emp_cidade"
        )
        .limit(5000),
      supabase
        .schema("mirror")
        .from("crm_negocios")
        .select(
          "ngo_numero, ngo_conclusao, ngo_vlrtotalnegociado, ngo_formaentrada, ngo_campanha, ngo_motivoperda, mpp_produtoperdamarca, cli_tipocliente, prd_condicaoproduto, prd_dscproduto, prd_marcaproduto, prd_grupoproduto, ngo_vendedores, cli_cidade, emp_cidade, ngo_datafechamento, ngo_datacadastro, ngo_dataatualizacao, dthregistro, ngo_funil"
        )
        .limit(5000),
      supabase
        .schema("mirror")
        .from("crm_pedidos_item")
        .select("pdo_codigointerno, pdo_itemdescricao, pdo_itemmarca, pdo_itemgrupo, pdo_itemmodelo, pdo_itemqtde, pdo_itemvlrunitario")
        .limit(10000),
    ]);

    const rawPedidos = pedidosRes.data ?? [];
    const rawNegocios = negociosRes.data ?? [];
    const rawItens = itensRes.data ?? [];

    // Dedup negócios canônicos
    const dedupNegociosMap = new Map<string, typeof rawNegocios[0]>();
    for (const n of rawNegocios) {
      if (n.ngo_funil?.toLowerCase().includes("repasse")) continue;
      if (!dedupNegociosMap.has(n.ngo_numero)) {
        dedupNegociosMap.set(n.ngo_numero, n);
      }
    }
    const negociosList = Array.from(dedupNegociosMap.values());
    const negociosByNgo = new Map(negociosList.map((n) => [n.ngo_numero, n]));

    // Dedup pedidos por pdo_codigointerno
    const dedupPedidosMap = new Map<string, typeof rawPedidos[0]>();
    for (const p of rawPedidos) {
      if (!dedupPedidosMap.has(p.pdo_codigointerno)) {
        dedupPedidosMap.set(p.pdo_codigointerno, p);
      }
    }
    const pedidosList = Array.from(dedupPedidosMap.values());

    const targetYear = options.ano || (options.from ? new Date(options.from).getFullYear() : new Date().getFullYear());

    // Pedidos Ganhos no período (Aprovado + Negócio Ganho + Sem Repasse)
    const pedidosGanhos = pedidosList.filter((p) => {
      const isAprovado = p.pdo_situacaopedido?.toLowerCase().includes("aprovado");
      if (!isAprovado) return false;
      const neg = negociosByNgo.get(p.ngo_numero);
      if (!neg || !neg.ngo_conclusao?.toLowerCase().includes("ganh")) return false;

      const dt = p.pdo_dthaprovacao || p.pdo_dthpedido;
      if (options.ano && dt && new Date(dt).getFullYear() !== options.ano) return false;
      if (options.from && dt && dt < options.from) return false;
      if (options.to && dt && dt > `${options.to}T23:59:59.999`) return false;

      if (options.vendedor && !p.pdo_vendedor?.toLowerCase().includes(options.vendedor.toLowerCase())) return false;
      if (options.cidade) {
        const match =
          p.pdo_cidadeufentrega?.toLowerCase().includes(options.cidade.toLowerCase()) ||
          p.emp_cidade?.toLowerCase().includes(options.cidade.toLowerCase());
        if (!match) return false;
      }
      return true;
    });

    const faturamentoTotal = pedidosGanhos.reduce((acc, p) => acc + (Number(p.pdo_vlrpedido) || 0), 0);
    const financiadoTotal = pedidosGanhos.reduce((acc, p) => acc + (Number(p.pdo_vlrfinanciado) || 0), 0);
    const proprioTotal = pedidosGanhos.reduce((acc, p) => acc + (Number(p.pdo_vlrrecursoproprio) || 0), 0);
    const totalPedidosAprovados = pedidosGanhos.length;
    const ticketMedioGeral = totalPedidosAprovados > 0 ? faturamentoTotal / totalPedidosAprovados : 0;

    // Negócios Perdidos no período
    const negociosPerdidos = negociosList.filter((n) => {
      if (!n.ngo_conclusao?.toLowerCase().includes("perd")) return false;
      const dt = n.ngo_datafechamento || n.ngo_datacadastro;
      if (options.ano && dt && new Date(dt).getFullYear() !== options.ano) return false;
      if (options.from && dt && dt < options.from) return false;
      if (options.to && dt && dt > `${options.to}T23:59:59.999`) return false;
      if (options.vendedor && !n.ngo_vendedores?.toLowerCase().includes(options.vendedor.toLowerCase())) return false;
      if (options.cidade && !n.cli_cidade?.toLowerCase().includes(options.cidade.toLowerCase())) return false;
      return true;
    });

    const valorPerdido = negociosPerdidos.reduce((acc, n) => acc + (Number(n.ngo_vlrtotalnegociado) || 0), 0);
    const pipelineAberto = negociosList
      .filter((n) => !n.ngo_conclusao?.toLowerCase().includes("perd") && !n.ngo_conclusao?.toLowerCase().includes("ganh"))
      .reduce((acc, n) => acc + (Number(n.ngo_vlrtotalnegociado) || 0), 0);

    // Série Mensal (1 a 12)
    const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    const serieMensal = monthNames.map((mesNome, idx) => {
      const mesNum = idx + 1;
      const ganhosM = pedidosList.filter((p) => {
        const dt = p.pdo_dthaprovacao || p.pdo_dthpedido;
        if (!dt) return false;
        const d = new Date(dt);
        if (d.getFullYear() !== targetYear || d.getMonth() + 1 !== mesNum) return false;
        const isAprov = p.pdo_situacaopedido?.toLowerCase().includes("aprovado");
        const neg = negociosByNgo.get(p.ngo_numero);
        return isAprov && neg && neg.ngo_conclusao?.toLowerCase().includes("ganh");
      });

      const perdasM = negociosList.filter((n) => {
        const dt = n.ngo_datafechamento || n.ngo_datacadastro;
        if (!dt) return false;
        const d = new Date(dt);
        return d.getFullYear() === targetYear && d.getMonth() + 1 === mesNum && n.ngo_conclusao?.toLowerCase().includes("perd");
      });

      return {
        mes: mesNum,
        mesNome,
        qtdGanho: ganhosM.length,
        valorGanho: ganhosM.reduce((a, b) => a + (Number(b.pdo_vlrpedido) || 0), 0),
        qtdPerda: perdasM.length,
        valorPerda: perdasM.reduce((a, b) => a + (Number(b.ngo_vlrtotalnegociado) || 0), 0),
      };
    });

    // 1. Ranking Vendedores
    const vendedorMap = new Map<string, { qtd: number; valor: number }>();
    for (const p of pedidosGanhos) {
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
    for (const p of pedidosGanhos) {
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

    // 3. Ranking Produtos (cruzar com itens de pedidos ganhos)
    const ganhosCodigos = new Set(pedidosGanhos.map((p) => p.pdo_codigointerno));
    const itemMap = new Map<string, { marca?: string; grupo?: string; qtd: number; valor: number }>();

    for (const item of rawItens) {
      if (!ganhosCodigos.has(item.pdo_codigointerno)) continue;
      const rawDesc = item.pdo_itemdescricao || item.pdo_itemmodelo || item.pdo_itemgrupo || "Produto sem Descrição";
      const cleanName = rawDesc.split("\n")[0].split(" - Descricao")[0].trim();
      const qtd = Math.max(1, Number(item.pdo_itemqtde) || 1);
      const vlrUnit = Number(item.pdo_itemvlrunitario) || 0;
      const vlrTotal = vlrUnit * qtd;

      const cur = itemMap.get(cleanName) || { marca: item.pdo_itemmarca || undefined, grupo: item.pdo_itemgrupo || undefined, qtd: 0, valor: 0 };
      cur.qtd += qtd;
      cur.valor += vlrTotal;
      itemMap.set(cleanName, cur);
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
    const origemMap = new Map<string, { qtd: number; valor: number }>();
    for (const p of pedidosGanhos) {
      const neg = negociosByNgo.get(p.ngo_numero);
      const orig = neg?.ngo_formaentrada?.trim() || "Não Informada";
      const cur = origemMap.get(orig) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(p.pdo_vlrpedido) || 0;
      origemMap.set(orig, cur);
    }
    const origensLead = Array.from(origemMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        valor: data.valor,
        percent: faturamentoTotal > 0 ? Number(((data.valor / faturamentoTotal) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 5. Financiamento e Bancos
    const bancoMap = new Map<string, { qtd: number; valor: number }>();
    for (const p of pedidosGanhos) {
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
    for (const p of pedidosGanhos) {
      const neg = negociosByNgo.get(p.ngo_numero);
      const tipo = neg?.cli_tipocliente?.trim() || "Produtor Rural";
      const cur = tipoCliMap.get(tipo) || { qtd: 0, valor: 0 };
      cur.qtd += 1;
      cur.valor += Number(p.pdo_vlrpedido) || 0;
      tipoCliMap.set(tipo, cur);
    }
    const tiposCliente = Array.from(tipoCliMap.entries())
      .map(([name, data]) => ({
        name,
        qtd: data.qtd,
        valor: data.valor,
        percent: faturamentoTotal > 0 ? Number(((data.valor / faturamentoTotal) * 100).toFixed(1)) : 0,
        ticketMedio: data.qtd > 0 ? Number((data.valor / data.qtd).toFixed(2)) : 0,
      }))
      .sort((a, b) => b.valor - a.valor);

    // 7. Motivos de Perda
    const perdaMap = new Map<string, { concorrente?: string; qtd: number; valor: number }>();
    for (const n of negociosPerdidos) {
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
    for (const p of pedidosList) {
      const isAprovado = p.pdo_situacaopedido?.toLowerCase().includes("aprovado");
      const dt = p.pdo_dthaprovacao || p.pdo_dthpedido;
      if (!isAprovado || !dt) continue;
      const neg = negociosByNgo.get(p.ngo_numero);
      if (!neg || !neg.ngo_conclusao?.toLowerCase().includes("ganh")) continue;
      const ano = new Date(dt).getFullYear();
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
        qtdPerdido: negociosPerdidos.length,
        pipelineAberto,
      },
      serieMensal,
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
