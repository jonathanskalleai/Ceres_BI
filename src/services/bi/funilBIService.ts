import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

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

const FUNIL_COLUMNS = [
  "NGO_Numero",
  "Funil_dsc",
  "Etapa_dscStatusNegocio",
  "FNE_DuracaoDias",
];

function mapMirrorRow(row: MirrorFunilRow): FunilEtapaRow {
  return {
    NGO_Numero: row.ngo_numero,
    Funil_dsc: row.funil_dsc,
    Etapa_dscStatusNegocio: row.etapa_dsc_status_negocio,
    FNE_DuracaoDias: row.fne_duracao_dias,
  };
}

async function fetchFromMirror(): Promise<FunilEtapaRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_funil_etapa")
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorFunilRow[]).map(mapMirrorRow);
}

async function fetchFromLegacy(): Promise<FunilEtapaRow[]> {
  return await fetchAllPages<FunilEtapaRow>(
    "VW_Ceres_CRM_Negocios_Etapas",
    FUNIL_COLUMNS,
  );
}

export async function fetchFunilBI(): Promise<FunilEtapaRow[]> {
  if (USE_MIRROR.crm_funil_etapa) {
    try {
      return await fetchFromMirror();
    } catch {
      return await fetchFromLegacy();
    }
  }
  try {
    return await fetchFromLegacy();
  } catch {
    return [];
  }
}
