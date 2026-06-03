import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

export interface OrdemServicoRow {
  OS_nrOS: string | number | null;
  OS_fStatus: string | null;
  SIT_dscSituacaoOS: string | null;
  OS_dthAbertura: string | null;
  OS_dthEncerramento: string | null;
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
}

const OS_COLUMNS = [
  "OS_nrOS",
  "OS_fStatus",
  "SIT_dscSituacaoOS",
  "OS_dthAbertura",
  "OS_dthEncerramento",
];

const ATD_COLUMNS = ["ATD_dscCausa", "ATD_DuracaoAtendimento"];
const OCR_COLUMNS = ["OSE_dscMotivoPausa", "OSE_dscSituacaoOcorrencia"];

function mapMirrorOS(row: MirrorOSRow): OrdemServicoRow {
  return {
    OS_nrOS: row.os_nr_os,
    OS_fStatus: row.os_f_status,
    SIT_dscSituacaoOS: row.sit_dsc_situacao_os,
    OS_dthAbertura: row.os_dth_abertura,
    OS_dthEncerramento: row.os_dth_encerramento,
  };
}

async function fetchOSFromMirror(): Promise<OrdemServicoRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("ordens_servico")
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorOSRow[]).map(mapMirrorOS);
}

export async function fetchOrdensServico(): Promise<OrdemServicoRow[]> {
  if (USE_MIRROR.ordens_servico) {
    try {
      return await fetchOSFromMirror();
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
