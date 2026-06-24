import { supabase } from "@/integrations/supabase/client";

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
  os_nros: string | number | null;
  os_fstatus: string | null;
  sit_dscsituacaoos: string | null;
  os_dthabertura: string | null;
  os_dthencerramento: string | null;
  emp_codfilial: string | null;
  tos_codtipoos: string | null;
}

const MIRROR_OS_SELECT = [
  "os_nros",
  "os_fstatus",
  "sit_dscsituacaoos",
  "os_dthabertura",
  "os_dthencerramento",
  "emp_codfilial",
  "tos_codtipoos",
].join(",");

interface MirrorAtendimentoRow {
  atd_dsc_causa: string | null;
  atd_duracao_atendimento: number | null;
}

interface MirrorOcorrenciaRow {
  ose_dsc_motivo_pausa: string | null;
  ose_dsc_situacao_ocorrencia: string | null;
}

function mapMirrorOS(row: MirrorOSRow): OrdemServicoRow {
  return {
    OS_nrOS: row.os_nros,
    OS_fStatus: row.os_fstatus?.trim() ?? null,
    SIT_dscSituacaoOS: row.sit_dscsituacaoos?.trim() ?? null,
    OS_dthAbertura: row.os_dthabertura,
    OS_dthEncerramento: row.os_dthencerramento,
    EMP_CodFilial: row.emp_codfilial?.trim() ?? "",
    TOS_CodTipoOS: row.tos_codtipoos?.trim() ?? "",
  };
}

export interface OrdensServicoFetchOptions {
  /** ISO YYYY-MM-DD */
  from?: string;
  /** ISO YYYY-MM-DD */
  to?: string;
}

export async function fetchOrdensServico(options?: OrdensServicoFetchOptions): Promise<OrdemServicoRow[]> {
  try {
    let q = supabase.schema("mirror").from("ordens_servico").select(MIRROR_OS_SELECT);
    if (options?.from) q = q.gte("os_dthabertura", options.from);
    if (options?.to) q = q.lte("os_dthabertura", `${options.to}T23:59:59.999`);
    q = q.limit(50000);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorOSRow[]).map(mapMirrorOS);
  } catch {
    return [];
  }
}

export async function fetchAtendimentosOS(): Promise<AtendimentoOSRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("atendimentos_os")
      .select("atd_dsc_causa,atd_duracao_atendimento")
      .limit(50000);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorAtendimentoRow[]).map((row) => ({
      ATD_dscCausa: row.atd_dsc_causa,
      ATD_DuracaoAtendimento: row.atd_duracao_atendimento,
    }));
  } catch {
    return [];
  }
}

export async function fetchOcorrencias(): Promise<OcorrenciaRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("ocorrencias_os")
      .select("ose_dsc_motivo_pausa,ose_dsc_situacao_ocorrencia")
      .limit(50000);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorOcorrenciaRow[]).map((row) => ({
      OSE_dscMotivoPausa: row.ose_dsc_motivo_pausa,
      OSE_dscSituacaoOcorrencia: row.ose_dsc_situacao_ocorrencia,
    }));
  } catch {
    return [];
  }
}
