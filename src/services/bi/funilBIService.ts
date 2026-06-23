import { supabase } from "@/integrations/supabase/client";

/**
 * Historico de etapas dos negocios (VW_Ceres_CRM_Negocios_Etapas).
 * FNE_DuracaoDias e o tempo que o negocio permaneceu naquela etapa —
 * a materia-prima para medir velocidade do funil e identificar gargalos.
 */
export interface FunilEtapaRow {
  NGO_Numero: string | null;
  Funil_dsc: string | null;
  Etapa_dscStatusNegocio: string | null;
  FNE_DuracaoDias: number | null;
}

interface MirrorFunilRow {
  ngo_numero: string | null;
  funil_dsc: string | null;
  etapa_dsc_status_negocio: string | null;
  fne_duracao_dias: number | null;
}

function mapMirrorRow(row: MirrorFunilRow): FunilEtapaRow {
  return {
    NGO_Numero: row.ngo_numero,
    Funil_dsc: row.funil_dsc,
    Etapa_dscStatusNegocio: row.etapa_dsc_status_negocio,
    FNE_DuracaoDias: row.fne_duracao_dias,
  };
}

export async function fetchFunilBI(): Promise<FunilEtapaRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("crm_funil_etapa")
      .select("*");
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorFunilRow[]).map(mapMirrorRow);
  } catch {
    return [];
  }
}
