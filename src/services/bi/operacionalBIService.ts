import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

/** Tempo dos tecnicos por dia (VW_Ceres_TecnicoTempo) — produtividade de campo. */
export interface TecnicoTempoRow {
  USR_nomeUsuario: string | null;
  TMP_TempoDisponivel: number | null;
  TMP_DuracaoAtendimento: number | null;
  TMP_DuracaoDeslocamento: number | null;
  TMP_KmRodado: number | null;
  TMP_TempoOcioso: number | null;
  TMP_TempoExtra: number | null;
}

/** Agendamentos de servico (VW_Ceres_Agenda). */
export interface AgendaRow {
  AGE_fStatus: string | null;
  TPS_dscTipoServicoAtendimento: string | null;
  USR_nomeUsuario: string | null;
}

interface MirrorAcaoRow {
  usr_nome_usuario: string | null;
  tmp_tempo_disponivel: number | null;
  tmp_duracao_atendimento: number | null;
  tmp_duracao_deslocamento: number | null;
  tmp_km_rodado: number | null;
  tmp_tempo_ocioso: number | null;
  tmp_tempo_extra: number | null;
  age_f_status: string | null;
  tps_dsc_tipo_servico_atendimento: string | null;
}

const TEMPO_COLUMNS = [
  "USR_nomeUsuario",
  "TMP_TempoDisponivel",
  "TMP_DuracaoAtendimento",
  "TMP_DuracaoDeslocamento",
  "TMP_KmRodado",
  "TMP_TempoOcioso",
  "TMP_TempoExtra",
];

const AGENDA_COLUMNS = ["AGE_fStatus", "TPS_dscTipoServicoAtendimento", "USR_nomeUsuario"];

function mapMirrorToTempo(row: MirrorAcaoRow): TecnicoTempoRow {
  return {
    USR_nomeUsuario: row.usr_nome_usuario,
    TMP_TempoDisponivel: row.tmp_tempo_disponivel,
    TMP_DuracaoAtendimento: row.tmp_duracao_atendimento,
    TMP_DuracaoDeslocamento: row.tmp_duracao_deslocamento,
    TMP_KmRodado: row.tmp_km_rodado,
    TMP_TempoOcioso: row.tmp_tempo_ocioso,
    TMP_TempoExtra: row.tmp_tempo_extra,
  };
}

function mapMirrorToAgenda(row: MirrorAcaoRow): AgendaRow {
  return {
    AGE_fStatus: row.age_f_status,
    TPS_dscTipoServicoAtendimento: row.tps_dsc_tipo_servico_atendimento,
    USR_nomeUsuario: row.usr_nome_usuario,
  };
}

async function fetchTempoFromMirror(): Promise<TecnicoTempoRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_acoes")
    .select("usr_nome_usuario,tmp_tempo_disponivel,tmp_duracao_atendimento,tmp_duracao_deslocamento,tmp_km_rodado,tmp_tempo_ocioso,tmp_tempo_extra")
    .not("tmp_tempo_disponivel", "is", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorAcaoRow[]).map(mapMirrorToTempo);
}

async function fetchAgendaFromMirror(): Promise<AgendaRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_acoes")
    .select("age_f_status,tps_dsc_tipo_servico_atendimento,usr_nome_usuario")
    .not("age_f_status", "is", null);
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorAcaoRow[]).map(mapMirrorToAgenda);
}

export async function fetchTecnicoTempo(): Promise<TecnicoTempoRow[]> {
  if (USE_MIRROR.crm_acoes) {
    try {
      return await fetchTempoFromMirror();
    } catch {
      return await fetchAllPages<TecnicoTempoRow>("VW_Ceres_TecnicoTempo", TEMPO_COLUMNS);
    }
  }
  try {
    return await fetchAllPages<TecnicoTempoRow>("VW_Ceres_TecnicoTempo", TEMPO_COLUMNS);
  } catch {
    return [];
  }
}

export async function fetchAgenda(): Promise<AgendaRow[]> {
  if (USE_MIRROR.crm_acoes) {
    try {
      return await fetchAgendaFromMirror();
    } catch {
      return await fetchAllPages<AgendaRow>("VW_Ceres_Agenda", AGENDA_COLUMNS);
    }
  }
  try {
    return await fetchAllPages<AgendaRow>("VW_Ceres_Agenda", AGENDA_COLUMNS);
  } catch {
    return [];
  }
}
