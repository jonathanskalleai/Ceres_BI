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

const FUNIL_COLUMNS = [
  "NGO_Numero",
  "Funil_dsc",
  "Etapa_dscStatusNegocio",
  "FNE_DuracaoDias",
];

export async function fetchFunilBI(): Promise<FunilEtapaRow[]> {
  try {
    return await fetchAllPages<FunilEtapaRow>(
      "VW_Ceres_CRM_Negocios_Etapas",
      FUNIL_COLUMNS,
    );
  } catch {
    return [];
  }
}
