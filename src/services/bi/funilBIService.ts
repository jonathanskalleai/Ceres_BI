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
  etapa_dscstatusnegocio: string | null;
  fne_duracaodias: number | null;
}

const MIRROR_FUNIL_SELECT = [
  "ngo_numero",
  "funil_dsc",
  "etapa_dscstatusnegocio",
  "fne_duracaodias",
].join(",");

function mapMirrorRow(row: MirrorFunilRow): FunilEtapaRow {
  return {
    NGO_Numero: row.ngo_numero,
    Funil_dsc: row.funil_dsc,
    Etapa_dscStatusNegocio: row.etapa_dscstatusnegocio,
    FNE_DuracaoDias: row.fne_duracaodias,
  };
}

export async function fetchFunilBI(): Promise<FunilEtapaRow[]> {
  try {
    const { data, error } = await supabase
      .schema("mirror")
      .from("crm_funil_etapa")
      .select(MIRROR_FUNIL_SELECT);
    if (error) throw new Error(error.message);
    return ((data ?? []) as MirrorFunilRow[]).map(mapMirrorRow);
  } catch {
    return [];
  }
}
