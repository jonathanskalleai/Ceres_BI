import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

export interface OrdemServicoRow {
  OS_nrOS: string | number | null;
  OS_fStatus: string | null;
  SIT_dscSituacaoOS: string | null;
  OS_dthAbertura: string | null;
  OS_dthEncerramento: string | null;
  EMP_CodFilial: string;
  TOS_CodTipoOS: string;
}

export interface AtendimentoOSRow {
  ATD_dscCausa: string | null;
  ATD_DuracaoAtendimento: number | null;
}

export interface OcorrenciaRow {
  OSE_dscMotivoPausa: string | null;
  OSE_dscSituacaoOcorrencia: string | null;
}

interface MirrorOSRow {
  os_nr_os: string | number | null;
  os_f_status: string | null;
  sit_dsc_situacao_os: string | null;
  os_dth_abertura: string | null;
  os_dth_encerramento: string | null;
  emp_cod_filial: string | null;
  tos_cod_tipo_os: string | null;
}

const OS_COLUMNS = [
  "OS_nrOS",
  "OS_fStatus",
  "SIT_dscSituacaoOS",
  "OS_dthAbertura",
  "OS_dthEncerramento",
];

const MIRROR_OS_SELECT = [
  "os_nr_os",
  "os_f_status",
  "sit_dsc_situacao_os",
  "os_dth_abertura",
  "os_dth_encerramento",
  "emp_cod_filial",
  "tos_cod_tipo_os",
].join(",");

const ATD_COLUMNS = ["ATD_dscCausa", "ATD_DuracaoAtendimento"];
const OCR_COLUMNS = ["OSE_dscMotivoPausa", "OSE_dscSituacaoOcorrencia"];

function mapMirrorOS(row: MirrorOSRow): OrdemServicoRow {
  return {
    OS_nrOS: row.os_nr_os,
    OS_fStatus: row.os_f_status?.trim() ?? null,
    SIT_dscSituacaoOS: row.sit_dsc_situacao_os?.trim() ?? null,
    OS_dthAbertura: row.os_dth_abertura,
    OS_dthEncerramento: row.os_dth_encerramento,
    EMP_CodFilial: row.emp_cod_filial?.trim() ?? "",
    TOS_CodTipoOS: row.tos_cod_tipo_os?.trim() ?? "",
  };
}

export interface OrdensServicoFetchOptions {
  /** ISO YYYY-MM-DD */
  from?: string;
  /** ISO YYYY-MM-DD */
  to?: string;
}

async function fetchOSFromMirror(options?: OrdensServicoFetchOptions): Promise<OrdemServicoRow[]> {
  let q = supabase.schema("mirror").from("ordens_servico").select(MIRROR_OS_SELECT);
  if (options?.from) q = q.gte("os_dth_abertura", options.from);
  if (options?.to) q = q.lte("os_dth_abertura", `${options.to}T23:59:59.999`);
  q = q.limit(50000);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorOSRow[]).map(mapMirrorOS);
}

export async function fetchOrdensServico(options?: OrdensServicoFetchOptions): Promise<OrdemServicoRow[]> {
  if (USE_MIRROR.ordens_servico) {
    try {
      return await fetchOSFromMirror(options);
    } catch {
      return await fetchAllPages<OrdemServicoRow>("VW_Ceres_OrdemServico", OS_COLUMNS);
    }
  }
  try {
    return await fetchAllPages<OrdemServicoRow>("VW_Ceres_OrdemServico", OS_COLUMNS);
  } catch {
    return [];
  }
}

export async function fetchAtendimentosOS(): Promise<AtendimentoOSRow[]> {
  // Atendimentos e Ocorrencias nao tem tabela mirror dedicada — mantemos legado
  try {
    return await fetchAllPages<AtendimentoOSRow>("VW_Ceres_AtendimentoOS", ATD_COLUMNS);
  } catch {
    return [];
  }
}

export async function fetchOcorrencias(): Promise<OcorrenciaRow[]> {
  try {
    return await fetchAllPages<OcorrenciaRow>("VW_Ceres_Ocorrencias", OCR_COLUMNS);
  } catch {
    return [];
  }
}
