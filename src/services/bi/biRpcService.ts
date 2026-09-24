import { invokeBiRpc } from "@/services/bi/biRpcGateway";
import { arrayOrEmpty, asRecord, normalizeRpcObject } from "@/services/bi/biResponseNormalize";
import {
  ACOES_BI_DEFAULTS,
  ADMIN_BI_DEFAULTS,
  INTELIGENCIA_BI_DEFAULTS,
  NEGOCIOS_BI_DEFAULTS,
  OPERACIONAL_BI_DEFAULTS,
  PARQUE_BI_DEFAULTS,
  PEDIDOS_BI_DEFAULTS,
  PRODUTOS_BI_DEFAULTS,
  RESULTADOS_NEGOCIOS_DEFAULTS,
  SERVICOS_BI_DEFAULTS,
} from "@/services/bi/biRpcDefaults";
import type {
  RpcNegociosBI,
  RpcPedidosBI,
  PedidosGrupoProdutoItem,
  PedidosMarcaProdutoItem,
  RpcServicosBI,
  RpcAdminBI,
  RpcAcoesBI,
  RpcAcoesDetalhe,
  RpcInteligenciaEsforcoBI,
  RpcParqueRenovacaoBI,
  RpcOperacionalBI,
  RpcProdutosBI,
  AcoesBIEvolucaoMensalAnoCorrente,
  RpcResultadosNegociosBI,
} from "@/types/biRpc";

/**
 * Calls rpc_negocios_bi — returns aggregated business deal metrics as JSON.
 */
export async function fetchNegociosBI(
  from: string,
  to: string,
  funis?: string[],
  vendedor?: string,
  cidade?: string,
): Promise<RpcNegociosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (funis && funis.length > 0) params.p_funis = funis;
    if (vendedor) params.p_vendedor = vendedor;
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await invokeBiRpc("rpc_negocios_bi", params);
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      NEGOCIOS_BI_DEFAULTS,
      ["kpis"],
      ["funilPorEtapa", "porOrigem", "motivosPerda", "evolucaoMensal", "rankingConsultor", "velocidadeFunil"],
      "rpc_negocios_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchNegociosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Primeira aba de Vendas & Resultados. O banco retorna KPIs conciliados com
 * Ações e os visuais derivados da junção canônica de negócio, pedido e ação.
 */
export async function fetchResultadosNegociosBI(
  from: string,
  to: string,
  vendedor?: string,
  cidade?: string,
): Promise<RpcResultadosNegociosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (vendedor) params.p_vendedor = vendedor;
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await invokeBiRpc("rpc_resultados_negocios_bi", params);
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      RESULTADOS_NEGOCIOS_DEFAULTS,
      ["kpis", "saudeCarteira"],
      ["funilPorEtapa", "projecaoAnual", "prioridadesFechamento", "motivosPerda"],
      "rpc_resultados_negocios_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchResultadosNegociosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/** Defensive defaults are shared with PedidoSection to keep the empty state DRY. */
export { PEDIDOS_BI_DEFAULTS } from "@/services/bi/biRpcDefaults";

/**
 * Calls rpc_pedidos_bi — returns aggregated order metrics as JSON.
 *
 * The deployed RPC still emits `grupoProduto`/`marcaProduto` (no `por` prefix);
 * the canonical contract is `porGrupoProduto`/`porMarcaProduto`. We accept both
 * here so the product charts render now and stay correct after the DB redeploy.
 */
export async function fetchPedidosBI(
  from: string,
  to: string,
  vendedor?: string,
  cidade?: string,
): Promise<RpcPedidosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (vendedor) params.p_vendedor = vendedor;
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await invokeBiRpc("rpc_pedidos_bi", params);
    if (error) throw new Error(error.message);
    const raw = asRecord(data) as Partial<RpcPedidosBI> & {
      grupoProduto?: PedidosGrupoProdutoItem[];
      marcaProduto?: PedidosMarcaProdutoItem[];
    };
    return normalizeRpcObject(
      {
        ...raw,
        porGrupoProduto: raw.porGrupoProduto ?? raw.grupoProduto,
        porMarcaProduto: raw.porMarcaProduto ?? raw.marcaProduto,
      },
      PEDIDOS_BI_DEFAULTS,
      ["kpis"],
      ["evolucaoMensal", "porSituacao", "mixPagamento", "porVendedor", "porCidade", "porGrupoProduto", "porMarcaProduto"],
      "rpc_pedidos_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchPedidosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_servicos_bi — returns aggregated OS metrics as JSON.
 */
export async function fetchServicosBI(
  from: string,
  to: string,
  cidade?: string,
): Promise<RpcServicosBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await invokeBiRpc("rpc_servicos_bi", params);
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      SERVICOS_BI_DEFAULTS,
      ["kpis"],
      ["porStatus", "faixasResolucao", "evolucaoAberturas", "situacaoOcorrencias", "motivosPausa", "causasAtendimento"],
      "rpc_servicos_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchServicosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_admin_bi — returns aggregated carteira/client metrics as JSON.
 * Optional cidade filter (snapshot table, no date filter).
 */
export async function fetchAdminBI(cidade?: string): Promise<RpcAdminBI> {
  try {
    const params: Record<string, unknown> = {};
    if (cidade) params.p_cidade = cidade;

    const { data, error } = await invokeBiRpc("rpc_admin_bi", params);
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      ADMIN_BI_DEFAULTS,
      ["kpis"],
      ["prospectVsAtivo", "porTipoCliente", "porUF", "porConsultor"],
      "rpc_admin_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchAdminBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_bi_periodo — returns action metrics with every visual
 * aggregate constrained to the selected calendar interval.
 */
export async function fetchAcoesBI(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}): Promise<RpcAcoesBI> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await invokeBiRpc("rpc_acoes_bi_periodo", rpcParams);
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      ACOES_BI_DEFAULTS,
      ["kpis"],
      ["porVendedor", "porCidade", "porMes", "porDiaSemana", "porTipoAcao", "porTipoContato", "listaAnos", "porVendedorCidade", "clientesMaisAtendidos"], "rpc_acoes_bi_periodo",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_visitas_mensal — serie de visitas por mes, no mesmo recorte
 * de filtros de /bi/acoes. Separada do agregado principal para manter o
 * contrato existente de rpc_acoes_bi estavel.
 */
export async function fetchAcoesVisitasMensal(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}): Promise<{ name: string; visitas: number }[]> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await invokeBiRpc("rpc_acoes_visitas_mensal", rpcParams);
    if (error) throw new Error(error.message);
    // Esta RPC RETORNA um JSON array. Ao contrario das RPCs que retornam um
    // objeto JSON, nao podemos usar `unwrapRpc`: ele pegaria apenas o primeiro
    // mes e entregaria um objeto onde o grafico espera uma lista.
    return Array.isArray(data) ? data as { name: string; visitas: number }[] : [];
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesVisitasMensal] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_evolucao_mensal_ano_corrente. The two evolution charts in
 * /bi/acoes intentionally always span January through the current month;
 * unlike the remaining visuals, the calendar period does not constrain them.
 */
export async function fetchAcoesEvolucaoMensalAnoCorrente(params: {
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}): Promise<AcoesBIEvolucaoMensalAnoCorrente[]> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;

    const { data, error } = await invokeBiRpc("rpc_acoes_evolucao_mensal_ano_corrente", rpcParams);
    if (error) throw new Error(error.message);
    // Esta RPC retorna diretamente uma lista JSON, sem o wrapper de objeto
    // usado pelas demais agregacoes de BI.
    return Array.isArray(data) ? data as AcoesBIEvolucaoMensalAnoCorrente[] : [];
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesEvolucaoMensalAnoCorrente] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_acoes_detalhe — paginated detail rows for the "Acoes do Periodo" table.
 *
 * Separada de `fetchAcoesBI` de proposito: `rpc_acoes_bi` roda 4x no app (2x em
 * AcoesSection para o comparativo de trend + 2x em usePainelKPIsRpc, que le SOMENTE
 * `kpis`). Manter ~660 linhas com observacao no payload monolitico faria esse peso
 * viajar 4 vezes, 2 delas para uma tela que nem renderiza tabela.
 */
export async function fetchAcoesDetalhe(params: {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
  statusNegocio?: string;
  limit?: number;
  offset?: number;
}): Promise<RpcAcoesDetalhe> {
  try {
    const rpcParams: Record<string, unknown> = {};
    if (params.from) rpcParams.p_from = params.from;
    if (params.to) rpcParams.p_to = params.to;
    if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
    if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
    if (params.cidade) rpcParams.p_cidade = params.cidade;
    if (params.statusNegocio) rpcParams.p_status = params.statusNegocio;
    if (params.limit != null) rpcParams.p_limit = params.limit;
    if (params.offset != null) rpcParams.p_offset = params.offset;

    const { data, error } = await invokeBiRpc("rpc_acoes_detalhe", rpcParams);
    if (error) throw new Error(error.message);

    const raw = asRecord(data);
    // Defensivo: RPC pode retornar null/objeto parcial se a função for redeployada.
    return {
      rows: arrayOrEmpty(raw.rows),
      total: typeof raw.total === "number" && Number.isFinite(raw.total) ? raw.total : 0,
    } as RpcAcoesDetalhe;
  } catch (err) {
    throw new Error(`[biRpcService.fetchAcoesDetalhe] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_inteligencia_esforco_bi — returns win rate + visitas/negocio metrics.
 */
export async function fetchInteligenciaEsforcoBI(
  from: string,
  to: string,
  funis?: string[] | null,
): Promise<RpcInteligenciaEsforcoBI> {
  try {
    const params: Record<string, unknown> = { p_from: from, p_to: to };
    if (funis && funis.length > 0) params.p_funis = funis;

    const { data, error } = await invokeBiRpc("rpc_inteligencia_esforco_bi", params);
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      INTELIGENCIA_BI_DEFAULTS,
      [],
      ["winRatePorVendedor", "visitasPorNegocioGanho"],
      "rpc_inteligencia_esforco_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchInteligenciaEsforcoBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_parque_renovacao_bi — returns fleet renewal opportunity by brand.
 */
export async function fetchParqueRenovacaoBI(
  cutoffAnos?: number,
): Promise<RpcParqueRenovacaoBI> {
  try {
    const { data, error } = await invokeBiRpc("rpc_parque_renovacao_bi", {
      p_cutoff_anos: cutoffAnos ?? 5,
    });
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      PARQUE_BI_DEFAULTS,
      [],
      ["frotaRenovacao"],
      "rpc_parque_renovacao_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchParqueRenovacaoBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_operacional_bi — returns aggregated technician productivity metrics.
 */
export async function fetchOperacionalBI(): Promise<RpcOperacionalBI> {
  try {
    const { data, error } = await invokeBiRpc("rpc_operacional_bi");
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      OPERACIONAL_BI_DEFAULTS,
      ["kpis"],
      ["kmPorTecnico", "utilizacaoPorTecnico", "agendaPorStatus", "agendaPorTipo"],
      "rpc_operacional_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchOperacionalBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}

/**
 * Calls rpc_produtos_bi — returns aggregated installed base (parque) metrics.
 */
export async function fetchProdutosBI(): Promise<RpcProdutosBI> {
  try {
    const { data, error } = await invokeBiRpc("rpc_produtos_bi");
    if (error) throw new Error(error.message);
    return normalizeRpcObject(
      data,
      PRODUTOS_BI_DEFAULTS,
      ["kpis"],
      ["porGrupo", "porMarca", "topModelos"],
      "rpc_produtos_bi",
    );
  } catch (err) {
    throw new Error(`[biRpcService.fetchProdutosBI] ${err instanceof Error ? err.message : "Unknown error"}`);
  }
}
