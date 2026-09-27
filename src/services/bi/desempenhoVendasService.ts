import { invokeBiRpc } from "@/services/bi/biRpcGateway";
import { fetchBiSemantic, isBiApiEnabled } from "@/services/bi/biApiTransport";
import { BiContractError, issue } from "@/types/biRuntime";
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
    totalPerdido: 0,
    qtdPerdido: 0,
    ticketMedioPerdido: 0,
    taxaConversao: 0,
    totalEmAndamento: 0,
    valorEmAndamento: 0,
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

function assertFiniteNumbers(value: unknown, path: string): void {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new BiContractError(
      "A consulta de desempenho retornou um número inválido.",
      [issue("BI_CONTRACT_NUMBER_INVALID", `${path} precisa ser um número finito`, path)],
      "BI_CONTRACT_NUMBER",
    );
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertFiniteNumbers(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, nested]) => assertFiniteNumbers(nested, `${path}.${key}`));
  }
}

/**
 * Busca a visão consolidada no banco. A agregação é exclusivamente server-side:
 * em caso de falha, o React Query preserva o último resultado em cache e expõe
 * o erro, sem baixar tabelas do schema mirror para cálculo no navegador.
 */
export async function fetchDesempenhoVendas(
  options: DesempenhoVendasFilterOptions = {}
): Promise<DesempenhoVendasData> {
  const params: Record<string, unknown> = {};
  if (options.from) params.p_from = options.from;
  if (options.to) params.p_to = options.to;
  if (options.ano) params.p_ano = options.ano;
  if (options.vendedor) params.p_vendedor = options.vendedor;
  if (options.cidade) params.p_cidade = options.cidade;
  if (options.condicao) params.p_condicao = options.condicao;
  if (options.produto) params.p_produto = options.produto;
  if (options.origem) params.p_origem = options.origem;
  if (options.banco) params.p_banco = options.banco;
  if (options.motivoPerda) params.p_motivo_perda = options.motivoPerda;
  // Keep the named argument present even when no funnel filter is active. The
  // production database exposes an overloaded RPC; an explicit null lets
  // PostgREST resolve the canonical signature that includes p_funis instead
  // of falling back to the legacy overload.
  params.p_funis = options.funis && options.funis.length > 0 ? options.funis : null;

  let data: unknown;
  if (isBiApiEnabled()) {
    data = await fetchBiSemantic("desempenho", params);
  } else {
    const legacy = await invokeBiRpc("rpc_desempenho_vendas_bi", params);
    if (legacy.error) throw legacy.error;
    data = legacy.data;
  }
  const rawValue = Array.isArray(data) ? data[0] : data;
  if (!rawValue || typeof rawValue !== "object" || Array.isArray(rawValue)) {
    throw new BiContractError(
      "A consulta de desempenho não retornou dados utilizáveis.",
      [issue("BI_CONTRACT_DATA_MISSING", "O bloco de desempenho não retornou um objeto de dados", "desempenho")],
      "BI_CONTRACT_MISSING",
    );
  }

  const raw = rawValue as Partial<DesempenhoVendasData>;
  assertFiniteNumbers(raw, "desempenho");
  if (!raw.kpis || typeof raw.kpis !== "object" || Array.isArray(raw.kpis)) {
    throw new BiContractError(
      "A consulta de desempenho retornou um contrato incompleto.",
      [issue("BI_CONTRACT_KPIS_MISSING", "O bloco kpis não foi retornado", "desempenho.kpis")],
      "BI_CONTRACT_INVALID",
    );
  }

  const requiredKpiFields: Array<keyof DesempenhoVendasData["kpis"]> = [
    "faturamento",
    "totalPedidos",
    "ticketMedio",
    "valorFinanciado",
    "valorRecursoProprio",
    "percentFinanciado",
    "valorPerdido",
    "totalPerdido",
    "qtdPerdido",
    "ticketMedioPerdido",
    "taxaConversao",
    "totalEmAndamento",
    "valorEmAndamento",
  ];
  const missingKpi = requiredKpiFields.find((key) => !(key in raw.kpis!));
  if (missingKpi) {
    throw new BiContractError(
      "A consulta de desempenho retornou um KPI incompleto.",
      [issue("BI_CONTRACT_KPI_FIELD_MISSING", `O campo ${String(missingKpi)} não foi retornado`, `desempenho.kpis.${String(missingKpi)}`)],
      "BI_CONTRACT_INVALID",
    );
  }
  const invalidKpi = requiredKpiFields.find((key) => {
    const value = raw.kpis?.[key];
    return typeof value !== "number" || !Number.isFinite(value);
  });
  if (invalidKpi) {
    throw new BiContractError(
      "A consulta de desempenho retornou um KPI inválido.",
      [issue("BI_CONTRACT_KPI_NUMBER_INVALID", `O campo ${String(invalidKpi)} precisa ser um número finito`, `desempenho.kpis.${String(invalidKpi)}`)],
      "BI_CONTRACT_NUMBER",
    );
  }
  if ("pipelineAberto" in raw.kpis! && raw.kpis.pipelineAberto !== undefined && raw.kpis.pipelineAberto !== null) {
    if (typeof raw.kpis.pipelineAberto !== "number" || !Number.isFinite(raw.kpis.pipelineAberto)) {
      throw new BiContractError(
        "A consulta de desempenho retornou pipelineAberto inválido.",
        [issue("BI_CONTRACT_KPI_NUMBER_INVALID", "pipelineAberto precisa ser um número finito", "desempenho.kpis.pipelineAberto")],
        "BI_CONTRACT_NUMBER",
      );
    }
  }

  const requiredArrays: Array<keyof DesempenhoVendasData> = [
    "serieMensal",
    "rankingVendedores",
    "rankingProdutos",
    "rankingCidades",
    "origensLead",
    "financiamentoBancos",
    "tiposCliente",
    "motivosPerda",
    "resumoAnual",
  ];
  const missingArray = requiredArrays.find((key) => !Array.isArray(raw[key]));
  if (missingArray) {
    throw new BiContractError(
      "A consulta de desempenho retornou um contrato incompleto.",
      [issue("BI_CONTRACT_ARRAY_MISSING", `O campo ${String(missingArray)} não foi retornado`, `desempenho.${String(missingArray)}`)],
      "BI_CONTRACT_INVALID",
    );
  }

  return {
    ...EMPTY_DESEMPENHO_DATA,
    ...raw,
    kpis: { ...EMPTY_DESEMPENHO_DATA.kpis, ...raw.kpis },
    serieMensal: raw.serieMensal ?? [],
    rankingProdutos: raw.rankingProdutos ?? [],
    perdas: raw.perdas,
  };
}
