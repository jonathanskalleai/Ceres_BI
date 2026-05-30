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

const OS_COLUMNS = [
  "OS_nrOS",
  "OS_fStatus",
  "SIT_dscSituacaoOS",
  "OS_dthAbertura",
  "OS_dthEncerramento",
];

const ATD_COLUMNS = ["ATD_dscCausa", "ATD_DuracaoAtendimento"];
const OCR_COLUMNS = ["OSE_dscMotivoPausa", "OSE_dscSituacaoOcorrencia"];

export async function fetchOrdensServico(): Promise<OrdemServicoRow[]> {
  try {
    return await fetchAllPages<OrdemServicoRow>("VW_Ceres_OrdemServico", OS_COLUMNS);
  } catch {
    return [];
  }
}

export async function fetchAtendimentosOS(): Promise<AtendimentoOSRow[]> {
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
