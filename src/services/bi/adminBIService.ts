import { supabase } from "@/integrations/supabase/client";
import { USE_MIRROR } from "@/config/featureFlags";
import { fetchAllPages, querySqlServer } from "@/services/sqlServerApi";

/** Carteira de clientes (VW_Ceres_CRM_CarteiraClientes). */
export interface CarteiraRow {
  CLI_idCliente: string | number | null;
  CLI_TipoCliente: string | null;
  CLI_Prospect: string | null;
  CLI_UF: string | null;
  CLI_Cidade: string | null;
  USR_NomeUsuario: string | null;
}

export interface OrgCounts {
  empresas: number;
  usuarios: number;
}

interface MirrorCarteiraRow {
  cli_id_cliente: string | number | null;
  cli_tipo_cliente: string | null;
  cli_prospect: string | null;
  cli_uf: string | null;
  cli_cidade: string | null;
  usr_nome_usuario: string | null;
}

const CARTEIRA_COLUMNS = [
  "CLI_idCliente",
  "CLI_TipoCliente",
  "CLI_Prospect",
  "CLI_UF",
  "CLI_Cidade",
  "USR_NomeUsuario",
];

function mapMirrorRow(row: MirrorCarteiraRow): CarteiraRow {
  return {
    CLI_idCliente: row.cli_id_cliente,
    CLI_TipoCliente: row.cli_tipo_cliente,
    CLI_Prospect: row.cli_prospect,
    CLI_UF: row.cli_uf,
    CLI_Cidade: row.cli_cidade,
    USR_NomeUsuario: row.usr_nome_usuario,
  };
}

async function fetchFromMirror(): Promise<CarteiraRow[]> {
  const { data, error } = await supabase
    .schema("mirror")
    .from("crm_carteira_clientes")
    .select("*");
  if (error) throw new Error(error.message);
  return ((data ?? []) as MirrorCarteiraRow[]).map(mapMirrorRow);
}

async function fetchFromLegacy(): Promise<CarteiraRow[]> {
  return await fetchAllPages<CarteiraRow>("VW_Ceres_CRM_CarteiraClientes", CARTEIRA_COLUMNS);
}

export async function fetchCarteira(): Promise<CarteiraRow[]> {
  if (USE_MIRROR.crm_carteira_clientes) {
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

export async function fetchOrgCounts(): Promise<OrgCounts> {
  const safeTotal = async (view: string): Promise<number> => {
    try {
      const { total } = await querySqlServer({ view, count_only: true });
      return total;
    } catch {
      return 0;
    }
  };
  const [empresas, usuarios] = await Promise.all([
    safeTotal("VW_Ceres_Empresas"),
    safeTotal("VW_Ceres_Usuario"),
  ]);
  return { empresas, usuarios };
}
