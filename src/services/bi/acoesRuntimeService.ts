import { supabase } from "@/integrations/supabase/client";
import { fetchBiApi, isBiApiEnabled } from "@/services/bi/biApiTransport";
import { fetchAcoesBatchBlock } from "@/services/bi/acoesBatchScheduler";
import { logClientError, logClientWarning } from "@/lib/logger";
import {
  isBiAbortError,
  isFiniteNumber,
  isRecord,
  normalizeBiError,
  requireArray,
  requireFiniteNumber,
  requireRecord,
  unwrapBiPayload,
  isValidCoordinate,
} from "@/lib/bi/runtime";
import type {
  RpcAcoesBI,
  RpcAcoesDetalhe,
  RpcAcoesFunilGestao,
  RpcAcoesMapaOportunidades,
  AcoesMapaPino,
} from "@/types/biRpc";

type RpcParams = Record<string, unknown>;

interface RpcResponse {
  data: unknown;
  error: { message?: string } | null;
}

interface RpcRequest extends PromiseLike<RpcResponse> {
  abortSignal(signal: AbortSignal): PromiseLike<RpcResponse>;
}

// The generated local Database type intentionally contains only the public
// tables. These analytical RPCs live in the VPS schema and are still exposed
// by PostgREST; keep the narrow cast at this transport boundary instead of
// weakening types across the application.
const rpcClient = supabase as unknown as {
  rpc(name: string, params: RpcParams): RpcRequest;
};

interface RequestOptions {
  signal?: AbortSignal;
}

export interface AcoesBIParams extends RequestOptions {
  from?: string;
  to?: string;
  vendedor?: string;
  tipoAcao?: string;
  cidade?: string;
}

export interface AcoesDetalheParams extends AcoesBIParams {
  statusNegocio?: string;
  limit?: number;
  offset?: number;
}

function withFilters(params: AcoesBIParams): RpcParams {
  const rpcParams: RpcParams = {};
  if (params.from) rpcParams.p_from = params.from;
  if (params.to) rpcParams.p_to = params.to;
  if (params.vendedor) rpcParams.p_vendedor = params.vendedor;
  if (params.tipoAcao) rpcParams.p_tipo_acao = params.tipoAcao;
  if (params.cidade) rpcParams.p_cidade = params.cidade;
  return rpcParams;
}

function toBiApiParams(params: RpcParams): RpcParams {
  const aliases: Record<string, string> = {
    p_from: "from",
    p_to: "to",
    p_vendedor: "vendedor",
    p_tipo_acao: "tipoAcao",
    p_cidade: "cidade",
    p_status: "statusNegocio",
    p_limit: "limit",
    p_offset: "offset",
  };
  return Object.entries(params).reduce<RpcParams>((result, [key, value]) => {
    result[aliases[key] ?? key] = value;
    return result;
  }, {});
}

function withErrorContext(error: unknown, rpcName: string): Error {
  const normalized = normalizeBiError(error);
  if (isBiAbortError(normalized)) {
    logClientWarning("bi.rpc_aborted", normalized, { rpc: rpcName });
    return normalized;
  }
  logClientError("bi.rpc_failed", normalized, { rpc: rpcName });
  if (normalized.name === "BiContractError") return normalized;
  return new Error(`[acoesRuntimeService.${rpcName}] ${normalized.message}`);
}

async function callRpc(rpcName: string, params: RpcParams, signal?: AbortSignal): Promise<unknown> {
  try {
    if (isBiApiEnabled()) {
      const endpointByRpc: Record<string, string> = {
        rpc_acoes_bi_periodo: "/acoes/core",
        rpc_acoes_detalhe: "/acoes/detalhe",
        rpc_acoes_funil_gestao_periodo: "/acoes/funil",
        rpc_acoes_mapa_oportunidades: "/acoes/mapa",
      };
      const endpoint = endpointByRpc[rpcName];
      if (!endpoint) throw new Error(`RPC sem rota BI API: ${rpcName}`);
      return await fetchBiApi(endpoint, toBiApiParams(params), signal);
    }
    const request = rpcClient.rpc(rpcName, params);
    const response = signal ? await request.abortSignal(signal) : await request;
    if (response.error) throw response.error;
    return response.data;
  } catch (error) {
    throw withErrorContext(error, rpcName);
  }
}

async function callBatchBlock(
  block: "core" | "funil",
  rpcName: string,
  params: AcoesBIParams,
): Promise<unknown> {
  try {
    return await fetchAcoesBatchBlock(block, params, params.signal);
  } catch (error) {
    throw withErrorContext(error, rpcName);
  }
}

function requireNumericFields(record: Record<string, unknown>, fields: string[], path: string): void {
  for (const field of fields) requireFiniteNumber(record[field], `${path}.${field}`);
}

function requireNullableNumericFields(record: Record<string, unknown>, fields: string[], path: string): void {
  for (const field of fields) {
    if (record[field] !== null) requireFiniteNumber(record[field], `${path}.${field}`);
  }
}

function requireArrayFields(record: Record<string, unknown>, fields: string[], path: string): void {
  for (const field of fields) requireArray(record[field], `${path}.${field}`);
}

function validateAcoesBI(payload: unknown): RpcAcoesBI {
  const root = requireRecord(unwrapBiPayload(payload), "rpc_acoes_bi_periodo");
  const kpis = requireRecord(root.kpis, "rpc_acoes_bi_periodo.kpis");
  requireNumericFields(kpis, [
    "totalAcoes", "cidades", "consultores", "visitas", "clientes", "tiposAcaoDistintos",
    "valorGanho", "negociosGanho", "valorPerdido", "negociosPerdido", "negociosOutrosStatus",
    "tempoMedioContato",
  ], "rpc_acoes_bi_periodo.kpis");
  requireArrayFields(root, [
    "porVendedor", "porCidade", "porMes", "porDiaSemana", "porTipoAcao", "porTipoContato",
    "listaAnos", "porVendedorCidade", "clientesMaisAtendidos",
  ], "rpc_acoes_bi_periodo");

  return root as unknown as RpcAcoesBI;
}

function validateAcoesDetalhe(payload: unknown): RpcAcoesDetalhe {
  const root = requireRecord(unwrapBiPayload(payload), "rpc_acoes_detalhe");
  requireFiniteNumber(root.total, "rpc_acoes_detalhe.total");
  const rows = requireArray(root.rows, "rpc_acoes_detalhe.rows");
  rows.forEach((row, index) => {
    const item = requireRecord(row, `rpc_acoes_detalhe.rows[${index}]`);
    if ("valor" in item && item.valor !== null) {
      requireFiniteNumber(item.valor, `rpc_acoes_detalhe.rows[${index}].valor`);
    }
  });
  return root as unknown as RpcAcoesDetalhe;
}

function validateFunil(payload: unknown): RpcAcoesFunilGestao {
  const root = requireRecord(unwrapBiPayload(payload), "rpc_acoes_funil_gestao_periodo");
  const funil = requireRecord(root.funil, "rpc_acoes_funil_gestao_periodo.funil");
  requireNumericFields(funil, [
    "visitas", "oportunidades", "valorOportunidades", "oportunidadesAbertas",
    "valorOportunidadesAbertas", "negociosAbertosTocadosNoPeriodo", "valorPipelineAbertoTocadoNoPeriodo",
    "entradasEtapaOportunidade", "emEtapaOportunidade", "ganhos", "perdidos", "valorPerdido",
  ], "rpc_acoes_funil_gestao_periodo.funil");
  requireNullableNumericFields(funil, ["visitasPorOportunidade", "oportPorFechamento"], "rpc_acoes_funil_gestao_periodo.funil");

  const ranking = requireArray(root.rankingConsultores, "rpc_acoes_funil_gestao_periodo.rankingConsultores");
  ranking.forEach((row, index) => {
    const item = requireRecord(row, `rpc_acoes_funil_gestao_periodo.rankingConsultores[${index}]`);
    requireNumericFields(item, ["visitas", "oportunidades", "ganhos", "perdidos", "valorGanho"], `ranking[${index}]`);
    requireNullableNumericFields(item, ["taxaConversao"], `ranking[${index}]`);
  });

  const diasParados = requireRecord(root.diasParados, "rpc_acoes_funil_gestao_periodo.diasParados");
  requireNumericFields(diasParados, ["negociosAbertos"], "rpc_acoes_funil_gestao_periodo.diasParados");
  requireNullableNumericFields(diasParados, ["mediana", "media"], "rpc_acoes_funil_gestao_periodo.diasParados");
  const meta = requireRecord(root.meta, "rpc_acoes_funil_gestao_periodo.meta");
  requireNumericFields(meta, ["acoesSemConsultor", "ganhosSemAtribuicao", "perdidosSemAtribuicao", "somaGanhosRanking"], "rpc_acoes_funil_gestao_periodo.meta");
  return root as unknown as RpcAcoesFunilGestao;
}

function sanitizeMapPins(payload: unknown): RpcAcoesMapaOportunidades {
  const root = requireRecord(unwrapBiPayload(payload), "rpc_acoes_mapa_oportunidades");
  requireNumericFields(root, ["total", "comCoordenada", "semCoordenada", "valorTotal", "valorNoMapa"], "rpc_acoes_mapa_oportunidades");
  const meta = requireRecord(root.meta, "rpc_acoes_mapa_oportunidades.meta");
  requireNumericFields(meta, ["viaAcao", "viaCarteira", "abertos", "ganhos", "perdidos"], "rpc_acoes_mapa_oportunidades.meta");

  const pins = requireArray(root.pinos, "rpc_acoes_mapa_oportunidades.pinos");
  const validPins: AcoesMapaPino[] = [];
  pins.forEach((pin, index) => {
    if (!isRecord(pin) || !isValidCoordinate(pin.lat, pin.lon)) {
      logClientWarning("bi.map_pin_discarded", new Error("Coordenada de pino invalida"), { index });
      return;
    }
    if (pin.valor !== null && pin.valor !== undefined && !isFiniteNumber(pin.valor)) {
      logClientWarning("bi.map_pin_discarded", new Error("Valor de pino invalido"), { index });
      return;
    }
    if (pin.acoesNoPeriodo !== undefined && !isFiniteNumber(pin.acoesNoPeriodo)) {
      logClientWarning("bi.map_pin_discarded", new Error("Quantidade de acoes invalida"), { index });
      return;
    }
    if (pin.diasParado !== null && pin.diasParado !== undefined && !isFiniteNumber(pin.diasParado)) {
      logClientWarning("bi.map_pin_discarded", new Error("Dias parado invalido"), { index });
      return;
    }
    validPins.push(pin as unknown as AcoesMapaPino);
  });

  return { ...(root as unknown as RpcAcoesMapaOportunidades), pinos: validPins };
}

export async function fetchAcoesRuntime(params: AcoesBIParams): Promise<RpcAcoesBI> {
  const payload = isBiApiEnabled()
    ? await callBatchBlock("core", "rpc_acoes_bi_periodo", params)
    : await callRpc("rpc_acoes_bi_periodo", withFilters(params), params.signal);
  try {
    return validateAcoesBI(payload);
  } catch (error) {
    throw withErrorContext(error, "rpc_acoes_bi_periodo");
  }
}

export async function fetchAcoesDetalheRuntime(params: AcoesDetalheParams): Promise<RpcAcoesDetalhe> {
  const rpcParams = withFilters(params);
  if (params.statusNegocio) rpcParams.p_status = params.statusNegocio;
  if (params.limit != null) rpcParams.p_limit = params.limit;
  if (params.offset != null) rpcParams.p_offset = params.offset;
  const payload = await callRpc("rpc_acoes_detalhe", rpcParams, params.signal);
  try {
    return validateAcoesDetalhe(payload);
  } catch (error) {
    throw withErrorContext(error, "rpc_acoes_detalhe");
  }
}

export async function fetchAcoesFunilPeriodoRuntime(params: AcoesBIParams): Promise<RpcAcoesFunilGestao> {
  const payload = isBiApiEnabled()
    ? await callBatchBlock("funil", "rpc_acoes_funil_gestao_periodo", params)
    : await callRpc("rpc_acoes_funil_gestao_periodo", withFilters(params), params.signal);
  try {
    return validateFunil(payload);
  } catch (error) {
    throw withErrorContext(error, "rpc_acoes_funil_gestao_periodo");
  }
}

export async function fetchAcoesMapaRuntime(params: Pick<AcoesBIParams, "vendedor" | "cidade" | "from" | "to"> & RequestOptions): Promise<RpcAcoesMapaOportunidades> {
  const payload = await callRpc("rpc_acoes_mapa_oportunidades", withFilters(params), params.signal);
  try {
    return sanitizeMapPins(payload);
  } catch (error) {
    throw withErrorContext(error, "rpc_acoes_mapa_oportunidades");
  }
}
