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

const PARQUE_COLUMNS = [
  "CLI_idCliente",
  "PQM_Grupo",
  "PQM_Marca",
  "PQM_Modelo",
  "PQM_QtdMaquinas",
];

export async function fetchParqueBI(): Promise<ParqueRow[]> {
  try {
    return await fetchAllPages<ParqueRow>("VW_Ceres_CRM_ClienteParqueMaquinas", PARQUE_COLUMNS);
  } catch {
    return [];
  }
}
