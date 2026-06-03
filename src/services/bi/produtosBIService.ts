import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages } from "@/services/sqlServerApi";

/**
 * Parque de maquinas instalado nos clientes (VW_Ceres_CRM_ClienteParqueMaquinas).
 * Base instalada e o "ouro" para pos-venda e cross-sell: o que cada cliente ja
 * possui, por grupo/marca/modelo.
 */
export interface ParqueRow {
  CLI_idCliente: string | number | null;
  PQM_Grupo: string | null;
  PQM_Marca: string | null;
  PQM_Modelo: string | null;
  PQM_QtdMaquinas: number | null;
}

interface MirrorParqueRow {
  cli_id_cliente: string | number | null;
  pqm_grupo: string | null;
  pqm_marca: string | null;
  pqm_modelo: string | null;
  pqm_qtd_maquinas: number | null;
}

const PARQUE_COLUMNS = [
  "CLI_idCliente",
  "PQM_Grupo",
  "PQM_Marca",
  "PQM_Modelo",
  "PQM_QtdMaquinas",
];

function mapMirrorRow(row: MirrorParqueRow): ParqueRow {
  return {
    CLI_idCliente: row.cli_id_cliente,
    PQM_Grupo: row.pqm_grupo,
    PQM_Marca: row.pqm_marca,
    PQM_Modelo: row.pqm_modelo,
    PQM_QtdMaquinas: row.pqm_qtd_maquinas,
  };
}

async function fetchFromMirror(): Promise<ParqueRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("cliente_parque_maquinas")
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorParqueRow[]).map(mapMirrorRow);
}

async function fetchFromLegacy(): Promise<ParqueRow[]> {
  return await fetchAllPages<ParqueRow>("VW_Ceres_CRM_ClienteParqueMaquinas", PARQUE_COLUMNS);
}

export async function fetchParqueBI(): Promise<ParqueRow[]> {
  if (USE_MIRROR.cliente_parque_maquinas) {
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
