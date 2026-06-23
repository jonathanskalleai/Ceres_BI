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

export async function fetchTecnicoTempo(): Promise<TecnicoTempoRow[]> {
  // Mirror crm_acoes does NOT have tempo columns (tmp_*) — use legacy only
  try {
    return await fetchAllPages<TecnicoTempoRow>("VW_Ceres_TecnicoTempo", TEMPO_COLUMNS);
  } catch {
    return [];
  }
}

export async function fetchAgenda(): Promise<AgendaRow[]> {
  // Mirror crm_acoes does NOT have agenda columns (age_*) — use legacy only
  try {
    return await fetchAllPages<AgendaRow>("VW_Ceres_Agenda", AGENDA_COLUMNS);
  } catch {
    return [];
  }
}
