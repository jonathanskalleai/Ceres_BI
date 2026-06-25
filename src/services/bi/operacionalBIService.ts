import { supabase } from "@/integrations/supabase/client";

/** Tempo dos tecnicos por dia — produtividade de campo. */
export interface TecnicoTempoRow {
  USR_nomeUsuario: string | null;
  TMP_TempoDisponivel: number | null;
  TMP_DuracaoAtendimento: number | null;
  TMP_DuracaoDeslocamento: number | null;
  TMP_KmRodado: number | null;
  TMP_TempoOcioso: number | null;
  TMP_TempoExtra: number | null;
}

/** Agendamentos de servico. */
export interface AgendaRow {
  AGE_fStatus: string | null;
  TPS_dscTipoServicoAtendimento: string | null;
  USR_nomeUsuario: string | null;
}

interface MirrorTempoRow {
  usr_nome_usuario: string | null;
  tmp_tempo_disponivel: number | null;
  tmp_duracao_atendimento: number | null;
  tmp_duracao_deslocamento: number | null;
  tmp_km_rodado: number | null;
  tmp_tempo_ocioso: number | null;
  tmp_tempo_extra: number | null;
}

interface MirrorAgendaRow {
  age_f_status: string | null;
  tps_dsc_tipo_servico_atendimento: string | null;
  usr_nome_usuario: string | null;
}

const TEMPO_SELECT = [
  "usr_nome_usuario",
  "tmp_tempo_disponivel",
  "tmp_duracao_atendimento",
  "tmp_duracao_deslocamento",
  "tmp_km_rodado",
  "tmp_tempo_ocioso",
  "tmp_tempo_extra",
].join(",");

const AGENDA_SELECT = "age_f_status,tps_dsc_tipo_servico_atendimento,usr_nome_usuario";

function mapMirrorTempo(row: MirrorTempoRow): TecnicoTempoRow {
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

function mapMirrorAgenda(row: MirrorAgendaRow): AgendaRow {
  return {
    AGE_fStatus: row.age_f_status?.trim() ?? null,
    TPS_dscTipoServicoAtendimento: row.tps_dsc_tipo_servico_atendimento?.trim() ?? null,
    USR_nomeUsuario: row.usr_nome_usuario?.trim() ?? null,
  };
}

export async function fetchTecnicoTempo(): Promise<TecnicoTempoRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("tecnico_tempo")
      .select(TEMPO_SELECT)
      .limit(50000);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorTempoRow[]).map(mapMirrorTempo);
  } catch {
    return [];
  }
}

export async function fetchAgenda(): Promise<AgendaRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("agenda_servico")
      .select(AGENDA_SELECT)
      .limit(50000);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorAgendaRow[]).map(mapMirrorAgenda);
  } catch {
    return [];
  }
}
